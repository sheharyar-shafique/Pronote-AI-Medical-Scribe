/**
 * Deepgram WebSocket streaming client.
 *
 * Replaces the previous Whisper batch-upload flow with a true real-time
 * streaming connection. Audio chunks are piped to Deepgram as they're
 * recorded; transcripts come back within ~300ms.
 *
 * Architecture:
 *
 *   getUserMedia → MediaRecorder ──audio chunks──► WebSocket ──► Deepgram
 *                                                                    │
 *                                                                    ▼
 *                                                            transcript events
 *                                                                    │
 *                                                                    ▼
 *                                       onInterim(text)  (live partial)
 *                                       onFinal(text)    (committed chunk)
 *
 * Why a fresh class instead of patching the old recording store: the previous
 * flow's contract was "give me a Blob array on stop". This flow's contract
 * is "stream me transcript text continuously". Trying to bolt one onto the
 * other produced a god-object with two overlapping state machines. Cleaner
 * to make this a dedicated client and replace the store's recording surface
 * to thinly wrap it.
 */
import { getAuthToken } from './api';

// API base — same env var the rest of the app uses
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface DeepgramTokenResponse {
  token: string;
  expiresAt: string;
  streamingParams: Record<string, string>;
}

export interface TranscriptUpdate {
  /** Text accumulated since the start of the session (final chunks only) */
  finalText: string;
  /** The most recent NON-final partial; updates rapidly as user speaks */
  interimText: string;
  /** Convenience: finalText + (interim ? '\n' + interim : '') for display */
  displayText: string;
}

export type RecordingStatus =
  | 'idle'
  | 'connecting'
  | 'recording'
  | 'paused'
  | 'stopping'
  | 'stopped'
  | 'error';

export interface DeepgramRecorderEvents {
  onTranscript: (update: TranscriptUpdate) => void;
  onStatusChange: (status: RecordingStatus, detail?: string) => void;
  onError: (error: Error) => void;
}

/**
 * Fetch a short-lived Deepgram API key from our backend. The backend talks
 * to Deepgram with the master key; the browser only sees the temp key.
 */
async function fetchDeepgramToken(): Promise<DeepgramTokenResponse> {
  const authToken = getAuthToken();
  const resp = await fetch(`${API_BASE_URL}/audio/deepgram-token`, {
    method: 'POST',
    headers: {
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(
      `Failed to fetch Deepgram token (${resp.status}): ${text || 'unknown'}`
    );
  }
  return resp.json();
}

/**
 * Streaming recorder. Owns the MediaStream, MediaRecorder, and the
 * WebSocket connection to Deepgram. Single-instance per page —
 * intended to be created on Start Recording and disposed on Stop.
 */
export class DeepgramRecorder {
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private ws: WebSocket | null = null;
  private finalText = '';
  private interimText = '';
  private status: RecordingStatus = 'idle';
  private events: DeepgramRecorderEvents;
  // Heartbeat to keep the WebSocket alive even during long pauses with no audio.
  // Deepgram closes idle connections after ~10s of silence, which would happen
  // if the patient is briefly quiet. We send a tiny silent keepalive every 5s.
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  // The Deepgram WS may close mid-recording (network blip, server restart).
  // We track this so onclose handlers don't fire spurious "stopped" status
  // when we actually want to reconnect.
  private intentionalClose = false;

  // ── Auto-reconnect state ────────────────────────────────────────────────────
  // When Deepgram drops the WebSocket mid-recording (session limit, network
  // blip, server rotation), we automatically mint a new token and reconnect.
  // The MediaRecorder keeps running throughout — audio chunks during the brief
  // reconnect window (~1-3s) are lost, but the accumulated transcript is
  // preserved and the session continues seamlessly.
  private static readonly MAX_RECONNECT_ATTEMPTS = 5;
  private static readonly RECONNECT_BASE_DELAY_MS = 1000; // exponential backoff base
  private reconnectAttempts = 0;
  private isReconnecting = false;
  private cachedStreamingParams: Record<string, string> | null = null;

  constructor(events: DeepgramRecorderEvents) {
    this.events = events;
  }

  private setStatus(s: RecordingStatus, detail?: string) {
    this.status = s;
    this.events.onStatusChange(s, detail);
  }

  private emitTranscript() {
    this.events.onTranscript({
      finalText: this.finalText,
      interimText: this.interimText,
      displayText:
        this.finalText +
        (this.interimText ? (this.finalText ? ' ' : '') + this.interimText : ''),
    });
  }

  async start(): Promise<void> {
    if (this.status !== 'idle') {
      throw new Error(`Cannot start: recorder is in ${this.status} state`);
    }
    this.setStatus('connecting');

    try {
      // 1. Mint a temporary Deepgram token via our backend.
      const tokenData = await fetchDeepgramToken();

      // 2. Capture microphone audio. Same constraints as the old flow —
      //    mono with cancellation/noise/AGC enabled. Browser picks the
      //    sample rate; Deepgram resamples internally.
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // 3. Pick a MediaRecorder mime type Deepgram can decode. Opus in
      //    a WebM container is broadly supported and is what Chrome /
      //    Firefox / Android prefer. iOS Safari only does MP4/AAC, so
      //    we fall back to that.
      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      const mimeType =
        candidates.find(
          (t) =>
            typeof MediaRecorder !== 'undefined' &&
            MediaRecorder.isTypeSupported(t)
        ) || '';

      // 4. Cache the streaming params for reconnection and open the WebSocket.
      this.cachedStreamingParams = tokenData.streamingParams;
      await this.connectWebSocket(tokenData.token, tokenData.streamingParams);

      // 5. Start MediaRecorder. timeslice=250ms means ondataavailable fires
      //    every 250ms with a small chunk of audio — low enough latency for
      //    Deepgram to emit interim results within ~500ms of speech.
      this.mediaRecorder = new MediaRecorder(
        this.stream,
        mimeType ? { mimeType } : undefined
      );
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0 && this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(e.data);
        }
      };
      this.mediaRecorder.start(250);

      this.setStatus('recording');
    } catch (err) {
      this.cleanup();
      this.setStatus('error', err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  // ── WebSocket setup (reusable for initial connect + reconnects) ────────────
  private async connectWebSocket(
    token: string,
    streamingParams: Record<string, string>
  ): Promise<void> {
    // Close any existing WS cleanly before opening a new one.
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    this.stopKeepalive();

    const params = new URLSearchParams(streamingParams);
    const wsUrl = `wss://api.deepgram.com/v1/listen?${params.toString()}`;

    this.ws = new WebSocket(wsUrl, ['token', token]);
    this.ws.binaryType = 'arraybuffer';

    // Wait for the WS to open.
    await new Promise<void>((resolve, reject) => {
      if (!this.ws) return reject(new Error('No WebSocket'));
      const openTimer = setTimeout(
        () => reject(new Error('WebSocket open timeout after 10s')),
        10_000
      );
      this.ws.addEventListener(
        'open',
        () => {
          clearTimeout(openTimer);
          resolve();
        },
        { once: true }
      );
      this.ws.addEventListener(
        'error',
        () => {
          clearTimeout(openTimer);
          reject(new Error('WebSocket failed to open'));
        },
        { once: true }
      );
    });

    // Wire incoming Deepgram messages → transcript callbacks.
    this.ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === 'Results' || (msg.channel && msg.channel.alternatives)) {
          // Successful transcript — reset reconnect counter since connection is healthy.
          this.reconnectAttempts = 0;
          const alt = msg.channel?.alternatives?.[0];
          const text: string = alt?.transcript ?? '';
          if (text) {
            if (msg.is_final) {
              const joiner = this.finalText && !this.finalText.endsWith(' ') ? ' ' : '';
              this.finalText += joiner + text.trim();
              this.interimText = '';
            } else {
              this.interimText = text.trim();
            }
            this.emitTranscript();
          }
        }
      } catch {
        // Non-JSON message — ignore.
      }
    });

    this.ws.addEventListener('close', (event) => {
      this.stopKeepalive();
      if (this.intentionalClose) return;

      // Unintentional close mid-recording — attempt automatic reconnection.
      // The MediaRecorder stays running so the mic never cuts out; audio
      // chunks during the brief reconnect gap (~1-3s) are silently dropped
      // (the ondataavailable guard checks ws.readyState), but the transcript
      // accumulated so far is preserved.
      console.warn(
        `[deepgram] WebSocket closed unexpectedly (code=${event.code}, reason=${event.reason || 'none'}). Attempting reconnect...`
      );
      this.attemptReconnect();
    });

    this.ws.addEventListener('error', () => {
      if (this.status !== 'stopping' && this.status !== 'stopped' && !this.isReconnecting) {
        // Don't overwrite status during reconnect — the UI already shows "Reconnecting..."
        console.warn('[deepgram] WebSocket error event');
      }
    });

    // Start keepalive — Deepgram closes idle connections after ~10s.
    this.keepaliveTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'KeepAlive' }));
      }
    }, 5_000);
  }

  // ── Auto-reconnect logic ──────────────────────────────────────────────────
  private async attemptReconnect(): Promise<void> {
    if (this.intentionalClose || this.isReconnecting) return;
    if (this.status === 'stopping' || this.status === 'stopped' || this.status === 'idle') return;

    if (this.reconnectAttempts >= DeepgramRecorder.MAX_RECONNECT_ATTEMPTS) {
      this.events.onError(
        new Error(
          `Deepgram disconnected and reconnection failed after ${DeepgramRecorder.MAX_RECONNECT_ATTEMPTS} attempts. ` +
          `Transcript captured so far has been preserved.`
        )
      );
      this.setStatus('error', 'Connection lost — could not reconnect');
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = DeepgramRecorder.RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1);
    this.setStatus(
      'recording', // keep 'recording' so the timer doesn't stop in the UI
      `Reconnecting to transcription (attempt ${this.reconnectAttempts}/${DeepgramRecorder.MAX_RECONNECT_ATTEMPTS})...`
    );
    // Also surface as a status detail for the live transcript panel
    this.events.onStatusChange(
      'connecting',
      `Reconnecting (${this.reconnectAttempts}/${DeepgramRecorder.MAX_RECONNECT_ATTEMPTS})...`
    );

    await new Promise((r) => setTimeout(r, delay));

    // Bail if user stopped recording during the backoff wait.
    if (this.intentionalClose || this.status === 'stopping' || this.status === 'stopped') {
      this.isReconnecting = false;
      return;
    }

    try {
      // Mint a fresh token — the old one may have expired.
      const tokenData = await fetchDeepgramToken();
      this.cachedStreamingParams = tokenData.streamingParams;

      await this.connectWebSocket(tokenData.token, tokenData.streamingParams);

      this.isReconnecting = false;
      this.setStatus('recording');
      console.log(
        `[deepgram] Reconnected successfully on attempt ${this.reconnectAttempts}. ` +
        `Transcript preserved (${this.finalText.split(/\s+/).length} words).`
      );
    } catch (err) {
      console.error('[deepgram] Reconnect attempt failed:', err);
      this.isReconnecting = false;
      // Try again (recursive — respects MAX_RECONNECT_ATTEMPTS)
      this.attemptReconnect();
    }
  }

  pause() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.setStatus('paused');
    }
  }

  resume() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this.setStatus('recording');
    }
  }

  /**
   * Stop recording and wait for Deepgram to flush any in-flight transcripts.
   * Returns the final committed transcript text.
   */
  async stop(): Promise<string> {
    if (this.status === 'idle' || this.status === 'stopped') {
      return this.finalText;
    }
    this.setStatus('stopping');
    this.intentionalClose = true;
    this.stopKeepalive();

    // Stop the recorder first so no new audio chunks are produced.
    try {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
    } catch {
      // ignore
    }

    // Tell Deepgram we're done sending audio. It will flush any pending
    // transcripts and then send a Metadata message + close. We wait up to
    // 5 seconds for the close — usually it's <500ms.
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'CloseStream' }));
      } catch {
        // ignore
      }
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 5_000);
        this.ws?.addEventListener(
          'close',
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true }
        );
      });
    }

    this.cleanup();
    this.setStatus('stopped');
    return this.finalText.trim();
  }

  /** Hard-stop without waiting — used on unmount or hard errors. */
  abort() {
    this.intentionalClose = true;
    this.isReconnecting = false;
    this.cleanup();
    this.setStatus('idle');
  }

  private stopKeepalive() {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  private cleanup() {
    this.stopKeepalive();
    try {
      this.mediaRecorder?.stop();
    } catch {}
    this.mediaRecorder = null;
    try {
      this.stream?.getTracks().forEach((t) => t.stop());
    } catch {}
    this.stream = null;
    try {
      this.ws?.close();
    } catch {}
    this.ws = null;
  }

  getTranscript(): string {
    return this.finalText.trim();
  }

  getStatus(): RecordingStatus {
    return this.status;
  }
}
