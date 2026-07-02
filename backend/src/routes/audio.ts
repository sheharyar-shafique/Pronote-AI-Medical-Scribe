import { Router, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { supabase } from '../lib/supabase.js';
import { openai } from '../lib/openai.js';
import { authenticate, requireActiveSubscription, AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/x-m4a', 'audio/mp4', 'audio/ogg', 'audio/webm'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(mp3|wav|m4a|ogg|webm)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio file type'));
    }
  },
});

// All routes require authentication
router.use(authenticate);
router.use(requireActiveSubscription);

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/audio/deepgram-token
//
// Mints a SHORT-LIVED Deepgram API key that the browser uses to open a direct
// WebSocket to Deepgram for real-time transcription. The master key
// (DEEPGRAM_API_KEY env var) never leaves the server.
//
// Why this pattern: browser-based apps cannot safely embed the master API key
// in JS, and Deepgram WebSocket auth has to live in the URL or sub-protocol
// where it's visible to the client. So we mint per-session temp keys instead:
//
//   - Scope: ONLY "usage:write" (can transcribe; cannot list/delete keys,
//     read billing, etc.). Even if a temp key leaks, the blast radius is one
//     project's transcription budget for 30 min.
//   - TTL: 30 min — long enough for a 2-hour visit with reconnects, short
//     enough that an old key from a closed tab can't sit around being abused.
//   - Tagged with the userId so we can audit which user spawned which key.
//
// Replaces the entire previous flow of upload-to-Supabase → /transcribe-direct
// → Whisper batch, which hit Whisper's 25 MB ceiling and infinite-fetch hangs
// on long client recordings.
// ──────────────────────────────────────────────────────────────────────────────
router.post('/deepgram-token', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const masterKey = process.env.DEEPGRAM_API_KEY;
    if (!masterKey) {
      throw new AppError(
        'Transcription service not configured — DEEPGRAM_API_KEY missing.',
        500
      );
    }

    // Step 1: look up the project id. Deepgram scopes keys per project, so we
    // need to know which project to create the temp key in. Most accounts have
    // exactly one project (the default), so we take the first one.
    const projectsResp = await fetch('https://api.deepgram.com/v1/projects', {
      headers: { Authorization: `Token ${masterKey}` },
    });
    if (!projectsResp.ok) {
      const errText = await projectsResp.text().catch(() => '');
      console.error('[deepgram] failed to fetch projects:', projectsResp.status, errText);
      throw new AppError('Transcription auth lookup failed', 502);
    }
    const projects: any = await projectsResp.json();
    const projectId: string | undefined = projects?.projects?.[0]?.project_id;
    if (!projectId) {
      throw new AppError('No Deepgram project found on this account', 502);
    }

    // Step 2: mint the temp key. Deepgram's response shape:
    //   { api_key_id, key, comment, scopes, created, expiration_date }
    // The "key" field is the full secret — visible exactly once.
    // TTL must comfortably exceed the app's 2-hour recording cap, otherwise the
    // key can expire MID-RECORDING and (depending on Deepgram enforcement) drop
    // the live stream — silently losing everything after the expiry point. The
    // old 30-minute TTL relied on a reconnect flow that was never implemented, so
    // any visit over 30 min was at risk. 2h15m gives headroom over the 2h cap.
    const TTL_SECONDS = 135 * 60; // 2 hours 15 minutes
    const keyResp = await fetch(
      `https://api.deepgram.com/v1/projects/${projectId}/keys`,
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${masterKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment: `pronote browser temp key for user ${req.user!.id}`,
          scopes: ['usage:write'],
          time_to_live_in_seconds: TTL_SECONDS,
          tags: ['pronote', 'browser', `user:${req.user!.id}`],
        }),
      }
    );
    if (!keyResp.ok) {
      const errText = await keyResp.text().catch(() => '');
      console.error('[deepgram] key mint failed:', keyResp.status, errText);
      throw new AppError('Failed to mint transcription token', 502);
    }
    const keyData: any = await keyResp.json();
    if (!keyData?.key) {
      throw new AppError('Deepgram did not return a token', 502);
    }

    res.json({
      token: keyData.key,
      expiresAt: new Date(Date.now() + TTL_SECONDS * 1000).toISOString(),
      // Surface the recommended Deepgram WebSocket query params so the
      // frontend doesn't have to hardcode them. nova-3-medical is the
      // clinical model; falls back to nova-3 if not available on plan.
      streamingParams: {
        model: 'nova-3-medical',
        language: 'en-US',
        smart_format: 'true',
        diarize: 'true',
        interim_results: 'true',
        endpointing: '300',           // ms of silence before finalizing a phrase
        utterance_end_ms: '1000',     // ms of silence before sending utterance_end
        vad_events: 'true',           // voice-activity events for UI feedback
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/audio/upload - Upload audio file
router.post('/upload', upload.single('audio'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (!req.file) {
      throw new AppError('No audio file provided', 400);
    }

    const fileId = uuidv4();
    const fileName = `${fileId}-${req.file.originalname}`;
    const storagePath = `audio/${req.user!.id}/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('audio-files')
      .getPublicUrl(storagePath);

    // Create audio file record
    const { data: audioFile, error: dbError } = await supabase
      .from('audio_files')
      .insert({
        user_id: req.user!.id,
        file_name: req.file.originalname,
        file_size: req.file.size,
        file_type: req.file.mimetype,
        storage_path: storagePath,
        transcription_status: 'pending',
      })
      .select()
      .single();

    if (dbError) throw dbError;

    res.status(201).json({
      id: audioFile.id,
      fileName: audioFile.file_name,
      fileSize: audioFile.file_size,
      url: urlData.publicUrl,
      status: 'pending',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/audio/transcribe-direct - Fast path: transcribe audio WITHOUT storing in Supabase.
// Skips upload→DB→download round-trip, saving 4-8 seconds per segment.
// Used by the frontend for real-time capture where speed matters most.
router.post('/transcribe-direct', upload.single('audio'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (!req.file) {
      throw new AppError('No audio file provided', 400);
    }

    if (!openai) {
      throw new AppError('AI service not configured', 500);
    }

    const buffer = req.file.buffer;

    // Reject tiny files
    if (buffer.length < 1024) {
      throw new AppError(`Audio file is too small (${buffer.length} bytes) — recording likely failed.`, 422);
    }

    // Reject files over 25 MB (Whisper limit)
    if (buffer.length > 25 * 1024 * 1024) {
      throw new AppError('Audio file exceeds 25 MB Whisper limit.', 413);
    }

    // Detect format from magic bytes
    const head = buffer.slice(0, 16);
    const sniffedExt =
      head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3 ? 'webm'
        : head[0] === 0x4f && head[1] === 0x67 && head[2] === 0x67 && head[3] === 0x53 ? 'ogg'
        : head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 ? 'wav'
        : head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33 ? 'mp3'
        : head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70 ? 'mp4'
        : head[0] === 0xff && (head[1] & 0xf0) === 0xf0 ? 'mp3'
        : 'webm';

    // Write temp file and transcribe directly — no Supabase involved
    const tempPath = path.join(os.tmpdir(), `whisper-direct-${Date.now()}.${sniffedExt}`);
    await fs.promises.writeFile(tempPath, buffer);

    try {
      const response = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempPath),
        model: 'whisper-1',
        language: 'en',
        response_format: 'text',
      });

      const transcription = typeof response === 'string' ? response : (response as any).text || '';

      // Quick silence check
      const meaningful = transcription.trim().split(/\s+/).filter((w: string) => w.length > 1);
      if (meaningful.length < 3) {
        res.json({ transcription: '', status: 'empty' });
        return;
      }

      res.json({ transcription, status: 'completed' });
    } finally {
      // Always clean up temp file
      fs.promises.unlink(tempPath).catch(() => {});
    }
  } catch (error) {
    next(error);
  }
});

// POST /api/audio/transcribe - Transcribe audio file using OpenAI Whisper
router.post('/transcribe', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { audioFileId } = req.body;

    if (!audioFileId) {
      throw new AppError('Audio file ID is required', 400);
    }

    // Get audio file record
    const { data: audioFile, error: fetchError } = await supabase
      .from('audio_files')
      .select('*')
      .eq('id', audioFileId)
      .eq('user_id', req.user!.id)
      .single();

    if (fetchError || !audioFile) {
      throw new AppError('Audio file not found', 404);
    }

    // Update status to processing
    await supabase
      .from('audio_files')
      .update({ transcription_status: 'processing' })
      .eq('id', audioFileId);

    // Download audio from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('audio-files')
      .download(audioFile.storage_path);

    if (downloadError || !fileData) {
      throw new AppError('Failed to download audio file', 500);
    }

    let transcription: string;

    if (openai) {
      // Pick a Whisper-supported extension from the stored MIME or filename.
      const cleanType = (audioFile.file_type || 'audio/webm').split(';')[0].trim();
      const extFromType: Record<string, string> = {
        'audio/webm': 'webm',
        'audio/mp4': 'mp4',
        'audio/mpeg': 'mp3',
        'audio/mp3': 'mp3',
        'audio/wav': 'wav',
        'audio/x-wav': 'wav',
        'audio/ogg': 'ogg',
        'audio/m4a': 'm4a',
        'audio/x-m4a': 'm4a',
      };
      const knownExts = ['mp3', 'mp4', 'm4a', 'wav', 'webm', 'ogg', 'flac', 'mpeg', 'mpga', 'oga'];
      const lowerName = (audioFile.file_name || '').toLowerCase();
      const matchedExt = knownExts.find(e => lowerName.endsWith('.' + e));
      const ext = matchedExt || extFromType[cleanType] || 'webm';

      // Detect the actual container from the file's magic bytes — the recorder's reported
      // MIME type can lie (Chrome reports webm but writes a different container occasionally).
      const buffer = Buffer.from(await fileData.arrayBuffer());
      const head = buffer.slice(0, 16);
      const sniffedExt =
        head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3 ? 'webm'
          : head[0] === 0x4f && head[1] === 0x67 && head[2] === 0x67 && head[3] === 0x53 ? 'ogg'
          : head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 ? 'wav'
          : head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33 ? 'mp3'
          : head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70 ? 'mp4'
          : head[0] === 0xff && (head[1] & 0xf0) === 0xf0 ? 'mp3'
          : null;

      // Trust the sniffed format over any metadata — that's what Whisper inspects too.
      const finalExt = sniffedExt || ext;
      const fileName = `recording.${finalExt}`;

      console.log(
        `[whisper] uploading: bytes=${buffer.length} reportedType=${audioFile.file_type} reportedName=${audioFile.file_name} ext=${finalExt} sniffed=${sniffedExt} magic=${head.slice(0, 8).toString('hex')}`
      );

      // Reject obviously-empty / tiny files before we burn an OpenAI request on them.
      if (buffer.length < 1024) {
        await supabase
          .from('audio_files')
          .update({ transcription_status: 'failed' })
          .eq('id', audioFileId);
        throw new AppError(
          `Audio file is too small (${buffer.length} bytes) — recording likely failed on the device.`,
          422
        );
      }

      // Whisper rejects uploads over 25 MB. Reject upfront with a clear message so the
      // user knows to re-record at a lower bitrate (or split the recording) instead of
      // waiting for the OpenAI call to fail.
      const WHISPER_MAX_BYTES = 25 * 1024 * 1024;
      if (buffer.length > WHISPER_MAX_BYTES) {
        await supabase
          .from('audio_files')
          .update({ transcription_status: 'failed' })
          .eq('id', audioFileId);
        const mb = (buffer.length / (1024 * 1024)).toFixed(1);
        throw new AppError(
          `Audio file is ${mb} MB — Whisper accepts up to 25 MB per upload. Please record at a lower bitrate or in shorter segments.`,
          413
        );
      }

      // Write to a temp file and stream it. fs.createReadStream is the upload method
      // OpenAI's docs themselves recommend; it always conveys the filename + extension
      // correctly to Whisper, which is what the "Invalid file format" error was about.
      const tempPath = path.join(os.tmpdir(), `whisper-${audioFileId}-${Date.now()}.${finalExt}`);
      await fs.promises.writeFile(tempPath, buffer);

      try {
        // Use text format for maximum speed. Speaker identification is handled
        // entirely by the GPT prompt — timestamps are not worth the extra latency.
        const response = await openai.audio.transcriptions.create({
          file: fs.createReadStream(tempPath),
          model: 'whisper-1',
          language: 'en',
          response_format: 'text',
        });

        transcription = typeof response === 'string' ? response : (response as any).text || '';
      } catch (whisperError: any) {
        console.error('Whisper transcription error:', whisperError?.message, whisperError?.status, whisperError?.error);
        await supabase
          .from('audio_files')
          .update({ transcription_status: 'failed' })
          .eq('id', audioFileId);

        const detail =
          whisperError?.error?.message ||
          whisperError?.message ||
          'unknown error';
        throw new AppError(`Transcription failed: ${detail}`, 422);
      } finally {
        fs.promises.unlink(tempPath).catch(() => {});
      }
    } else {
      // Mock transcription for development
      transcription = generateMockTranscription();
    }

    // ── Silence / empty-audio guard ──────────────────────────────────────────
    // Whisper returns an empty string (or a very short filler) when it detects
    // no speech. Reject the request so the frontend shows a helpful error
    // instead of generating a hallucinated note.
    const meaningfulWords = transcription.trim().split(/\s+/).filter(w => w.length > 1);
    if (meaningfulWords.length < 5) {
      await supabase
        .from('audio_files')
        .update({ transcription_status: 'failed' })
        .eq('id', audioFileId);
      throw new AppError(
        'No speech detected in the recording. Please speak clearly during the visit before stopping.',
        422
      );
    }

    // Update audio file with transcription
    await supabase
      .from('audio_files')
      .update({ 
        transcription_status: 'completed',
      })
      .eq('id', audioFileId);

    res.json({
      audioFileId,
      transcription,
      status: 'completed',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/audio/generate-note - Generate clinical note from transcription
router.post('/generate-note', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { transcription, template, patientName, sectionSettings, patientContext, treatmentPlan, templateSections } = req.body;

    if (!transcription || !template) {
      throw new AppError('Transcription and template are required', 400);
    }

    // Guard: refuse to generate a note from silence / empty audio
    const meaningfulWords = (transcription as string).trim().split(/\s+/).filter((w: string) => w.length > 1);
    if (meaningfulWords.length < 5) {
      throw new AppError(
        'No speech detected. Please record an actual patient conversation before generating a note.',
        422
      );
    }

    let noteContent: Record<string, string>;
    let source: 'ai' | 'mock' = 'ai';

    if (openai) {
      // ── Real AI path ──────────────────────────────────────────────────────
      // Priority: (1) custom sectionSettings → dynamic prompt
      //           (2) dedicated built-in prompt for the template id
      //           (3) templateSections from the frontend → auto-generated prompt
      //           (4) generic default fallback
      let systemPrompt: string;
      const dedicatedPrompt = getDedicatedPrompt(template);
      if (sectionSettings && sectionSettings.length > 0) {
        // Built-in templates now also send sectionSettings (the frontend synthesizes
        // defaults from the section list). When a dedicated specialty prompt exists
        // for this template, KEEP its rich clinical field requirements (e.g. the
        // psychiatry MSE, cardiology diagnostics) and just LAYER the user's
        // formatting preferences on top — otherwise we'd flatten every specialty
        // into a generic prompt. Custom templates have no dedicated prompt, so they
        // use the fully dynamic prompt as before.
        systemPrompt = dedicatedPrompt
          ? dedicatedPrompt + buildFormattingOverride(sectionSettings)
          : buildDynamicPrompt(sectionSettings);
      } else if (dedicatedPrompt) {
        systemPrompt = dedicatedPrompt;
      } else if (Array.isArray(templateSections) && templateSections.length > 0) {
        systemPrompt = buildPromptFromSections(templateSections, template);
      } else {
        systemPrompt = getSystemPromptForTemplate(template);
      }

      // Patient Context + Treatment Plan (both set on the patient's profile page) are
      // durable, apply to every note for this patient, and may include known conditions /
      // goals / planned care that never come up in conversation. Prepend them to the
      // transcription so the AI can use them without re-prompting per recording.
      const trimmedContext =
        typeof patientContext === 'string' ? patientContext.trim() : '';
      const trimmedPlan =
        typeof treatmentPlan === 'string' ? treatmentPlan.trim() : '';

      const preambleParts: string[] = [];
      if (trimmedContext) {
        preambleParts.push(
          `Persistent patient context (apply to every note for this patient — combine with the transcription, do not output verbatim):\n${trimmedContext}`
        );
      }
      if (trimmedPlan) {
        preambleParts.push(
          `Active treatment plan for this patient (reflect ongoing therapies / goals / monitoring in the relevant sections; update or note progress against it where the transcription warrants):\n${trimmedPlan}`
        );
      }
      const preamble = preambleParts.join('\n\n');

      // Do NOT drop the middle of the transcript. The models have a 128k-token
      // (~96k-word) context window, so even a 2-hour visit (~19k words) fits with
      // huge headroom. The old 6,000-word cap kept only the first 1,500 + last
      // 4,500 words and deleted everything in between — which is exactly where the
      // "main story" of a long visit lives, so long recordings lost their core
      // content. We only trim in the extreme case (3h+ of audio, well beyond the
      // app's 2-hour recording cap), and even then we preserve far more and keep
      // the most recent portion intact.
      const MAX_TRANSCRIPT_WORDS = 24000; // ~3 hours of speech; realistic visits never hit this
      let processedTranscription = transcription as string;
      const allWords = processedTranscription.split(/\s+/);
      const wordCount = allWords.length;
      if (wordCount > MAX_TRANSCRIPT_WORDS) {
        const beginning = allWords.slice(0, 8000).join(' ');
        const ending = allWords.slice(-14000).join(' ');
        processedTranscription = `${beginning}\n\n[... a middle portion of this unusually long ${wordCount}-word transcript was omitted to fit processing limits; the opening and the most recent ~14,000 words are preserved ...]\n\n${ending}`;
        console.log(`[transcript] Extremely long transcript (${wordCount} words) trimmed to ~22,000, middle omitted.`);
      }

      // Quality-first model selection: gpt-4.1 is the primary for EVERY note.
      // Measured head-to-head on the same visit transcript with the same prompt:
      // gpt-4o-mini ≈ 595 words, gpt-4o ≈ 794, gpt-4.1 ≈ 1,287 — and gpt-4.1 is
      // also the best at honoring the per-section length floors and the
      // ROS / exam scaffolding ("not assessed" subsections) that make notes read
      // like a complete clinical document. It's also slightly faster than gpt-4o.
      // Users comparing against competitor scribes found shorter notes
      // unacceptable, so depth is the top requirement here.
      const primaryModel = 'gpt-4.1';
      const secondaryModel = 'gpt-4o';

      // Trailing reinforcement: models weight instructions at the END of the user
      // message far more heavily than mid-system-prompt rules. Without this, the
      // model tends to compress sections to ~60-100 words despite the length floor.
      const DEPTH_REMINDER =
        '\n\n[Documentation requirements — apply strictly: write an EXHAUSTIVE clinical note, not a summary. ' +
        'Every major section must run 150+ words when the visit contains material for it. ' +
        'Use labeled subsections on separate lines. Include a complete labeled Review of Systems and the full set of standard exam subsections, marking unexamined ones "not assessed". ' +
        'Restate every number mentioned (doses, vitals, weights, durations). Include every pertinent negative as its own statement. ' +
        'A longer, complete note is always preferred to a shorter one.]';

      const userMessage = (preamble
        ? `${preamble}\n\nGenerate a clinical note from this transcription:\n\n${processedTranscription}`
        : `Generate a clinical note from this transcription:\n\n${processedTranscription}`) + DEPTH_REMINDER;

      let lastError: Error | null = null;

      // Fallback chain: try the length-appropriate primary model first, then the
      // secondary, then gpt-3.5-turbo as a last resort. max_tokens is raised to
      // 16,000 (the models' max) so long, detailed multi-section notes — especially
      // custom templates — are never cut off mid-JSON (which would fail the parse).
      try {
        const response = await openai.chat.completions.create({
          model: primaryModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: 16000,
        });
        const raw = response.choices[0].message.content || '{}';
        noteContent = JSON.parse(raw);
        console.log(`✅ ${primaryModel} note generated for template: ${template} (${wordCount} words)`);
      } catch (miniPrimaryError: any) {
        console.error(`${primaryModel} failed, escalating to ${secondaryModel}:`, miniPrimaryError.message);
        lastError = miniPrimaryError;

        // Fall back to the other strong model.
        try {
          const response = await openai.chat.completions.create({
            model: secondaryModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage + ' Return valid JSON only.' },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
            max_tokens: 16000,
          });
          const raw = response.choices[0].message.content || '{}';
          noteContent = JSON.parse(raw);
          console.log(`✅ ${secondaryModel} note generated for template: ${template}`);
          lastError = null;
        } catch (miniError: any) {
          console.error(`${secondaryModel} also failed:`, miniError.message);
          lastError = miniError;

          // Last resort: gpt-4o-mini (fast, always available)
          try {
            const response = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage + ' Return ONLY valid JSON, no markdown.' },
              ],
              response_format: { type: 'json_object' },
              temperature: 0.3,
              max_tokens: 16000,
            });
            const raw = response.choices[0].message.content || '{}';
            const match = raw.match(/```json\s*([\s\S]*?)\s*```/) || raw.match(/(\{[\s\S]*\})/);
            noteContent = JSON.parse(match ? (match[1] || match[0]) : raw);
            console.log(`✅ gpt-4o-mini (last resort) note generated for template: ${template}`);
            lastError = null;
          } catch (gpt35Error: any) {
            console.error('All GPT models failed:', gpt35Error.message);
            lastError = gpt35Error;
          }
        }
      }

      // If ALL models failed — throw a proper error. Do NOT silently use mock.
      if (lastError) {
        const msg = (lastError as any).status === 429
          ? 'AI service rate limit reached. Please wait a moment and try again.'
          : (lastError as any).status === 401
          ? 'AI service authentication error — please contact support.'
          : 'AI note generation failed. Please try again.';
        throw new AppError(msg, 503);
      }
    } else {
      // ── Development / no API key ──────────────────────────────────────────
      // Only use mock data when no OpenAI key is configured (local dev)
      console.warn('⚠️  No OpenAI key — returning mock note content (dev mode)');
      noteContent = generateMockNoteContent(template, patientName);
      source = 'mock';
    }

    res.json({
      content: normalizeNoteContent(noteContent!),
      template,
      source, // 'ai' = real GPT output, 'mock' = dev placeholder
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Coerce every section of the model's JSON into a plain string.
 *
 * When a section is styled as bullet points, GPT sometimes returns it as a JSON
 * array of bullet strings (or a nested object of subsections) instead of one
 * string — despite the prompt asking for strings. The notes API validates each
 * section with z.string(), so an array here surfaces to the user as
 * "Validation failed: content.objective: Expected string, received array".
 * Normalize at the source: arrays join into newline-separated "• " lines,
 * nested objects flatten to "Label: value" lines.
 */
function normalizeNoteContent(content: Record<string, unknown>): Record<string, unknown> {
  const toText = (v: unknown): string =>
    typeof v === 'string' ? v : v == null ? '' : JSON.stringify(v);

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(content)) {
    if (typeof value === 'string') {
      out[key] = value;
    } else if (Array.isArray(value)) {
      out[key] = value
        .map((item) => {
          const s = toText(item).trim();
          return s.startsWith('•') || s.startsWith('-') ? s : `• ${s}`;
        })
        .filter(Boolean)
        .join('\n');
    } else if (value && typeof value === 'object') {
      if (key === 'customSections') {
        // Schema allows this as an object map — just stringify its values.
        out[key] = Object.fromEntries(
          Object.entries(value).map(([k, v]) => [k, toText(v)])
        );
      } else {
        out[key] = Object.entries(value)
          .map(([label, v]) => `${label}: ${toText(v).trim()}`)
          .join('\n');
      }
    } else {
      out[key] = toText(value);
    }
  }
  return out;
}

// POST /api/audio/generate-treatment-plan — Synthesize a treatment plan from 1–3 notes
router.post('/generate-treatment-plan', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { noteIds, patientName } = req.body as { noteIds?: string[]; patientName?: string };

    if (!Array.isArray(noteIds) || noteIds.length === 0) {
      throw new AppError('At least one note ID is required.', 400);
    }
    if (noteIds.length > 3) {
      throw new AppError('You can base a treatment plan on at most 3 notes.', 400);
    }

    // Fetch the user's notes by ID — RLS ensures cross-user access can't happen, but
    // we still scope by user_id explicitly so a malicious payload can't expose another
    // user's notes via predictable ids.
    const { data: notes, error: fetchError } = await supabase
      .from('clinical_notes')
      .select('id, patient_name, date_of_service, template, note_contents(*)')
      .in('id', noteIds)
      .eq('user_id', req.user!.id);

    if (fetchError) throw fetchError;
    if (!notes || notes.length === 0) {
      throw new AppError('Notes not found.', 404);
    }

    // Build a compact corpus the model can reason over.
    const corpus = notes.map((n: any, i: number) => {
      const c = n.note_contents || {};
      const fields = [
        ['Subjective', c.subjective],
        ['Objective', c.objective],
        ['Chief Complaint', c.chief_complaint],
        ['HPI', c.history_of_present_illness],
        ['Physical Exam', c.physical_exam],
        ['Assessment', c.assessment],
        ['Plan', c.plan],
        ['Patient Instructions', c.instructions],
      ]
        .filter(([, v]) => typeof v === 'string' && (v as string).trim())
        .map(([label, v]) => `${label}: ${v}`)
        .join('\n');
      return `### Note ${i + 1} (${n.template}, ${n.date_of_service ?? 'undated'})\n${fields || '(empty)'}`;
    }).join('\n\n');

    let plan: string;
    let source: 'ai' | 'mock' = 'ai';

    if (openai) {
      const systemPrompt = `You are an expert clinician composing a longitudinal treatment plan for a single patient based on their existing clinical notes.

Output a clear, actionable treatment plan as plain text (no markdown headers like ##; use simple numbered or bulleted lines). Cover, where the notes support it:

1. Diagnoses and problem list (active conditions, severity, stability)
2. Lifestyle / behavioral interventions (diet, exercise, sleep, substance use)
3. Medications (current regimen, target adjustments, when to titrate)
4. Diagnostics / labs (what to monitor, frequency, target values)
5. Specialist referrals (who, why, when)
6. Patient goals (specific, measurable, time-bound where possible)
7. Follow-up cadence and red-flag warning signs

Use only information that is supported by the provided notes — do not invent diagnoses, medications, or test results. If a section has no supporting evidence in the notes, omit it. Keep it concise but specific. Do not echo the notes verbatim.`;

      const userMessage = `Patient: ${patientName || '(unnamed)'}\n\nNotes:\n\n${corpus}\n\nWrite the treatment plan now.`;

      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.3,
        });
        plan = (response.choices[0].message.content || '').trim();
        if (!plan) throw new Error('Empty response');
      } catch (err: any) {
        // Fallback to gpt-4o-mini
        try {
          const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage },
            ],
            temperature: 0.3,
          });
          plan = (response.choices[0].message.content || '').trim();
          if (!plan) throw new Error('Empty response');
        } catch (innerErr: any) {
          throw new AppError(
            innerErr?.error?.message || innerErr?.message || 'Failed to generate treatment plan',
            502
          );
        }
      }
    } else {
      source = 'mock';
      plan = `1. Continue current management as documented in the most recent visit.\n2. Lifestyle: nutrition counseling and 30 minutes of moderate activity 5 days/week.\n3. Monitoring: track relevant vitals and symptom diary between visits.\n4. Follow-up: return to clinic in 4 weeks; sooner if new or worsening symptoms.`;
    }

    res.json({ plan, source });
  } catch (error) {
    next(error);
  }
});

// POST /api/audio/generate-report — Diagnosis-focused report from notes in a date range
router.post('/generate-report', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { noteIds, diagnosis, patientName, startDate, endDate } = req.body as {
      noteIds?: string[];
      diagnosis?: string;
      patientName?: string;
      startDate?: string;
      endDate?: string;
    };

    if (!Array.isArray(noteIds) || noteIds.length === 0) {
      throw new AppError('At least one note ID is required.', 400);
    }
    if (!diagnosis || !diagnosis.trim()) {
      throw new AppError('Diagnosis is required.', 400);
    }
    if (!startDate || !endDate) {
      throw new AppError('Report period (startDate and endDate) is required.', 400);
    }

    const { data: notes, error: fetchError } = await supabase
      .from('clinical_notes')
      .select('id, patient_name, date_of_service, template, note_contents(*)')
      .in('id', noteIds)
      .eq('user_id', req.user!.id);

    if (fetchError) throw fetchError;
    if (!notes || notes.length === 0) {
      throw new AppError('Notes not found for the selected period.', 404);
    }

    const corpus = notes
      .sort((a: any, b: any) =>
        new Date(a.date_of_service || 0).getTime() - new Date(b.date_of_service || 0).getTime()
      )
      .map((n: any, i: number) => {
        const c = n.note_contents || {};
        const fields = [
          ['Subjective', c.subjective],
          ['Objective', c.objective],
          ['Chief Complaint', c.chief_complaint],
          ['HPI', c.history_of_present_illness],
          ['Physical Exam', c.physical_exam],
          ['Assessment', c.assessment],
          ['Plan', c.plan],
          ['Patient Instructions', c.instructions],
        ]
          .filter(([, v]) => typeof v === 'string' && (v as string).trim())
          .map(([label, v]) => `${label}: ${v}`)
          .join('\n');
        return `### Note ${i + 1} — ${n.template} (${n.date_of_service ?? 'undated'})\n${fields || '(empty)'}`;
      })
      .join('\n\n');

    let content: string;
    let source: 'ai' | 'mock' = 'ai';

    if (openai) {
      const systemPrompt = `You are a clinician composing a focused longitudinal report on a single diagnosis for a single patient.

Output a clear, well-structured report as plain text (no markdown headers like ##; use simple section labels followed by a colon). Base it strictly on the provided notes.

Cover, where the notes support it:

1. Summary — one short paragraph stating diagnosis, date range, and overall trajectory.
2. Timeline of relevant findings — chronological bullets of symptom changes, exam findings, lab/imaging values, and interventions specifically related to the diagnosis.
3. Treatment summary — medications tried (with response), procedures, lifestyle interventions.
4. Outcome and current status — symptom severity now vs. start of period, functional status, controlled vs. uncontrolled.
5. Open issues / next steps — what still needs follow-up, planned tests, referrals.

Constraints:
- Stay focused on the named diagnosis; do not pad with unrelated visits.
- Use only information present in the notes; do not invent results, doses, or comorbidities.
- If a section has no supporting evidence, omit it rather than padding.
- Keep it factual and concise. No greeting, signature, or boilerplate disclaimer.`;

      const userMessage = `Patient: ${patientName || '(unnamed)'}
Diagnosis to report on: ${diagnosis}
Report period: ${startDate} to ${endDate}

Source notes (in chronological order):

${corpus}

Write the report now.`;

      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.3,
        });
        content = (response.choices[0].message.content || '').trim();
        if (!content) throw new Error('Empty response');
      } catch (err: any) {
        try {
          const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage },
            ],
            temperature: 0.3,
          });
          content = (response.choices[0].message.content || '').trim();
          if (!content) throw new Error('Empty response');
        } catch (innerErr: any) {
          throw new AppError(
            innerErr?.error?.message || innerErr?.message || 'Failed to generate report',
            502
          );
        }
      }
    } else {
      source = 'mock';
      content = `Summary:\n${diagnosis} during ${startDate} – ${endDate} based on ${notes.length} note${notes.length === 1 ? '' : 's'} in the chart. AI key not configured on the server, so this is a placeholder.\n\nTimeline:\n- ${notes.length} encounter${notes.length === 1 ? '' : 's'} reviewed.\n\nNext steps:\n- Configure OPENAI_API_KEY on the server to generate real AI reports.`;
    }

    res.json({ content, source });
  } catch (error) {
    next(error);
  }
});

// GET /api/audio/files - List user's audio files
router.get('/files', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { data: files, error } = await supabase
      .from('audio_files')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(files.map(file => ({
      id: file.id,
      fileName: file.file_name,
      fileSize: file.file_size,
      fileType: file.file_type,
      duration: file.duration_seconds,
      status: file.transcription_status,
      createdAt: file.created_at,
    })));
  } catch (error) {
    next(error);
  }
});

// DELETE /api/audio/files/:id - Delete audio file
router.delete('/files/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    // Get file record
    const { data: file, error: fetchError } = await supabase
      .from('audio_files')
      .select('storage_path')
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .single();

    if (fetchError || !file) {
      throw new AppError('Audio file not found', 404);
    }

    // Delete from storage
    await supabase.storage
      .from('audio-files')
      .remove([file.storage_path]);

    // Delete record
    await supabase
      .from('audio_files')
      .delete()
      .eq('id', id);

    res.json({ message: 'Audio file deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Helper functions

/**
 * Build a dynamic AI system prompt from user-configured section settings.
 * Called when a custom template with sectionSettings is used.
 */
interface SectionSetting {
  title: string;
  verbosity: 'concise' | 'detailed';
  styling: 'paragraph' | 'bullet';
  content: string;
  stylingInstructions: string;
}

// Map common section titles to the JSON-safe camelCase keys the prompts emit.
// Shared by buildDynamicPrompt and buildFormattingOverride so a section's styling
// override lands on the same field the content was written into.
const SECTION_TITLE_TO_KEY: Record<string, string> = {
  'Subjective': 'subjective',
  'Objective': 'objective',
  'Assessment': 'assessment',
  'Plan': 'plan',
  'Patient Instructions': 'instructions',
  'Instructions': 'instructions',
  'Chief Complaint': 'chiefComplaint',
  'History of Present Illness': 'historyOfPresentIllness',
  'HPI': 'historyOfPresentIllness',
  'Review of Systems': 'reviewOfSystems',
  'Physical Exam': 'physicalExam',
  'Mental Status Exam': 'physicalExam',
  'Medical Decision Making': 'medicalDecisionMaking',
  'Follow-Up': 'followUp',
};

function sectionTitleToKey(title: string): string {
  return (
    SECTION_TITLE_TO_KEY[title] ||
    title.replace(/[^a-zA-Z0-9]/g, '').replace(/^(.)/, (_, c) => c.toLowerCase())
  );
}

/**
 * Build a formatting-override block to append AFTER a dedicated specialty prompt.
 *
 * The dedicated prompts (soap, psychiatry, cardiology, …) define WHAT clinical
 * content each field must contain but say nothing about bullet-vs-paragraph or
 * concise-vs-detailed. This block layers the user's per-section formatting
 * preferences on top WITHOUT discarding the specialty content requirements, and
 * is explicitly marked as taking precedence over the general verbosity guidance
 * baked into those prompts.
 */
function buildFormattingOverride(settings: SectionSetting[]): string {
  const lines = settings
    .map((s) => {
      const key = sectionTitleToKey(s.title);
      const styling =
        s.styling === 'bullet'
          ? 'format as bullet points (prefix each point with "• ")'
          : 'format as flowing narrative paragraphs (no bullets)';
      const verbosity =
        s.verbosity === 'concise'
          ? 'keep it concise — 2-3 focused sentences maximum'
          : 'be thorough and detailed';
      const extra = s.stylingInstructions?.trim()
        ? ` Additional instructions: ${s.stylingInstructions.trim()}`
        : '';
      return `- "${key}" ("${s.title}"): ${styling}; ${verbosity}.${extra}`;
    })
    .join('\n');

  return `

SECTION FORMATTING PREFERENCES (these OVERRIDE any general verbosity/format guidance above — keep the clinical content requirements, but present each field in the specified format):
${lines}

If a "concise" preference conflicts with an earlier "minimum 3-5 sentences" instruction, the concise preference wins for that field.

CRITICAL OUTPUT RULE: Every field value MUST be a single JSON string — NEVER a JSON array and NEVER a nested object. For bullet-formatted sections, put each bullet on its own line INSIDE the string, separated by \\n characters, e.g. "• First point\\n• Second point".`;
}

function buildDynamicPrompt(settings: SectionSetting[]): string {
  const getKey = sectionTitleToKey;

  // Build per-section instructions
  const sectionInstructions = settings.map(s => {
    const key = getKey(s.title);
    const verbosityHint = s.verbosity === 'concise'
      ? 'Keep this section concise — 2-3 focused sentences maximum.'
      : 'Be thorough and comprehensive in this section — target 120-250+ words covering every relevant detail from the transcription, with labeled subsections where clinically standard. Do NOT compress or summarize away detail.';
    const stylingHint = s.styling === 'bullet'
      ? 'Format this section as bullet points (use "• " prefix for each point).'
      : 'Format this section as flowing narrative paragraphs.';
    const contentHint = s.content
      ? `Content guidance: ${s.content}`
      : '';
    const customHint = s.stylingInstructions
      ? `Additional instructions: ${s.stylingInstructions}`
      : '';

    return `- "${key}" (section title: "${s.title}"):
  ${verbosityHint}
  ${stylingHint}
  ${contentHint}
  ${customHint}`.trim();
  }).join('\n\n');

  // Build the JSON schema example
  const jsonKeys = settings.map(s => `  "${getKey(s.title)}": "..."`).join(',\n');

  // Always include instructions
  const hasInstructions = settings.some(s =>
    s.title.toLowerCase().includes('instruction') || getKey(s.title) === 'instructions'
  );
  const instructionsNote = hasInstructions
    ? ''
    : `\n- "instructions": Always include a comprehensive patient instructions section with medications, activity level, warning signs, and follow-up timeline. Format as bullet points.`;

  return `You are an expert medical documentation assistant specializing in thorough clinical documentation.
Generate a comprehensive clinical note from the given patient-clinician transcription.

Return a JSON object with EXACTLY these fields plus a "topic" field:
{
  "topic": "...",
${jsonKeys}${hasInstructions ? '' : ',\n  "instructions": "..."'}
}

SECTION-SPECIFIC FORMATTING REQUIREMENTS:

${sectionInstructions}
${instructionsNote}

IMPORTANT RULES:
- Return ONLY valid JSON. Do NOT wrap in markdown code blocks.
- Every field value MUST be a single JSON string — NEVER a JSON array and NEVER a nested object. For bullet sections, separate bullets with \\n characters inside the string, e.g. "• First point\\n• Second point".
- Use proper medical terminology throughout.
- Every section MUST contain real clinical content derived from the transcription.
- If the transcription doesn't mention something for a section, write reasonable clinical defaults or note "Not discussed during this encounter."
- The output MUST respect the formatting preferences specified above (bullet vs paragraph, concise vs detailed).
- "topic" is REQUIRED: a short, specific clinical title summarizing this visit (4-8 words, Title Case).
  Good examples: "Leg and Headache Symptoms Evaluation", "Acute Upper Respiratory Infection Follow-Up",
  "Chest Pain Evaluation with Hypertension". Do NOT include the patient name. Do NOT start with "Patient"
  or "Visit for". Do NOT use generic titles like "Clinical Note".

SPEAKER IDENTIFICATION (CRITICAL):
The transcription is from a recorded two-person conversation between a CLINICIAN and a PATIENT,
captured with a single microphone. Speakers are NOT labeled in the text.
Use contextual clues to determine who is speaking:
- Questions about symptoms, examination maneuvers, history inquiries → CLINICIAN speaking
- Descriptions of symptoms, personal concerns, pain reports → PATIENT speaking
- Clinical instructions, prescriptions, follow-up plans → CLINICIAN speaking
Apply this when writing each section — e.g. subjective sections should contain ONLY the PATIENT's
reported symptoms and history, while objective sections should contain ONLY the CLINICIAN's findings.`;
}

/**
 * Check if a template has a dedicated hand-written prompt. Returns the prompt
 * string if found, or null if the template should use a dynamically-generated one.
 */
function getDedicatedPrompt(template: string): string | null {
  const DETAIL_INSTRUCTION = getDetailInstruction();
  const prompts: Record<string, string> = getDedicatedPrompts(DETAIL_INSTRUCTION);
  return prompts[template.toLowerCase()] || null;
}

function getSystemPromptForTemplate(template: string): string {
  const DETAIL_INSTRUCTION = getDetailInstruction();
  const prompts = getDedicatedPrompts(DETAIL_INSTRUCTION);
  return prompts[template.toLowerCase()] || prompts.default;
}

/**
 * Build a dynamic system prompt from an array of section NAMES (e.g. ['Chief Complaint',
 * 'History of Present Illness', 'Physical Exam', 'Assessment', 'Plan']).
 *
 * This is the key fix: the frontend defines 40+ templates with specific section arrays,
 * but only 8 had dedicated prompts. All others silently fell to a generic SOAP default.
 * Now, when the frontend sends templateSections, we auto-generate a prompt that asks GPT
 * to return JSON with exactly those sections — making every template functional.
 */
function buildPromptFromSections(sections: string[], templateId: string): string {
  const DETAIL_INSTRUCTION = getDetailInstruction();

  // Map human-readable section titles to JSON-safe camelCase keys.
  // This MUST match the sectionKeyMap in the frontend's NoteEditorPage so the
  // generated JSON lands in the right fields.
  const sectionKeyMap: Record<string, string> = {
    'Subjective': 'subjective',
    'Objective': 'objective',
    'Assessment': 'assessment',
    'Plan': 'plan',
    'Patient Instructions': 'instructions',
    'Instructions': 'instructions',
    'Chief Complaint': 'chiefComplaint',
    'History of Present Illness': 'historyOfPresentIllness',
    'History': 'historyOfPresentIllness',
    'Review of Systems': 'reviewOfSystems',
    'Physical Exam': 'physicalExam',
    'Physical Examination Findings': 'physicalExam',
    'Mental Status Exam': 'physicalExam',
    'Mental Status': 'physicalExam',
    'Medical Decision Making': 'medicalDecisionMaking',
    'Follow-Up': 'followUp',
    'Follow-Up Schedule': 'followUp',
    'Assessment & Plan': 'plan',
    'Letter to Patient': 'instructions',
    'Patient Identification': 'chiefComplaint',
    'Medical History': 'historyOfPresentIllness',
    'Current Medications': 'reviewOfSystems',
    'Identifying Information': 'chiefComplaint',
    'Past Medical History': 'historyOfPresentIllness',
    'Date & Provider': 'chiefComplaint',
    'Clinical Findings': 'objective',
    'Patient Information': 'chiefComplaint',
    'Care Plan': 'plan',
    'Medications': 'reviewOfSystems',
    'Goals & Education': 'instructions',
    'Health Goals': 'chiefComplaint',
    'Lifestyle Assessment': 'subjective',
    'Nutrition': 'objective',
    'Physical Activity': 'assessment',
    'Mental Wellbeing': 'reviewOfSystems',
    'Safety Assessment': 'medicalDecisionMaking',
    'Presenting Problem': 'chiefComplaint',
    'Diagnosis': 'assessment',
    'Risk Factors': 'medicalDecisionMaking',
    'Social History': 'reviewOfSystems',
    'Client Identification': 'chiefComplaint',
    'Session Narrative': 'subjective',
    'Clinical Observations': 'objective',
    'Progress Evaluation': 'assessment',
    'Plan of Action': 'plan',
    'Demographics': 'chiefComplaint',
    'Presenting Concerns': 'subjective',
    'Psychiatric History': 'historyOfPresentIllness',
    'Substance Use History': 'reviewOfSystems',
    'Family History': 'reviewOfSystems',
    'Diagnosis & Treatment Plan': 'plan',
    'Session Summary': 'subjective',
    'Interventions': 'assessment',
    'Client Response': 'objective',
    'Client Presentation': 'subjective',
    'Progress': 'assessment',
    'Growth & Development': 'objective',
    'Developmental History': 'historyOfPresentIllness',
    'Cardiac History': 'historyOfPresentIllness',
    'ECG/Imaging': 'objective',
    'Diagnostic Findings': 'objective',
    'Skin Exam': 'physicalExam',
    'Lesion Description': 'objective',
    'Distribution': 'physicalExam',
    'Associated Symptoms': 'reviewOfSystems',
    'Mechanism of Injury': 'historyOfPresentIllness',
    'Imaging': 'objective',
    'Imaging Findings': 'objective',
    'Injury Mechanism': 'historyOfPresentIllness',
    // Therapy-specific
    'Goal': 'chiefComplaint',
    'Intervention': 'assessment',
    'Response': 'objective',
    // Nursing
    'Patient Assessment': 'subjective',
    'Vital Signs': 'objective',
    'Nursing Interventions': 'assessment',
    'Medication Administration': 'reviewOfSystems',
    'Patient Response': 'objective',
    'Plan of Care': 'plan',
    'Patient Demographics': 'chiefComplaint',
    'Diagnosis & History': 'historyOfPresentIllness',
    'Current Status': 'objective',
    'Active Orders': 'plan',
    'Handoff Notes': 'instructions',
    // Dietetics
    'Nutrition Diagnosis': 'assessment',
    'Monitoring & Evaluation': 'followUp',
    // Administrative
    'Referring Provider': 'objective',
    'Reason for Referral': 'chiefComplaint',
    'Clinical Summary': 'assessment',
    'Additional Notes': 'instructions',
    'Consent Explanation': 'subjective',
    'Risks & Benefits': 'objective',
    'Patient Agreement': 'assessment',
    'Provider Signature': 'plan',
    'Clinical Justification': 'assessment',
    'Provider Information': 'objective',
    'Letter Statement': 'instructions',
    'Patient Details': 'chiefComplaint',
    'Diagnosis / Condition': 'assessment',
    'Recommended Rest Period': 'plan',
    'Restrictions': 'instructions',
    'Provider Certification': 'followUp',
    'Insurance Details': 'objective',
    'Diagnosis Codes': 'assessment',
    'Procedure Codes': 'plan',
    'Claim Statement': 'instructions',
    // Mental health extras
    'Protective Factors': 'objective',
    'Suicidal Ideation': 'assessment',
    'Self-Harm History': 'historyOfPresentIllness',
    'Safety Plan': 'plan',
    'Clinician Determination': 'instructions',
    'Biological Factors': 'subjective',
    'Psychological Factors': 'objective',
    'Social Factors': 'reviewOfSystems',
    'Treatment Recommendations': 'plan',
    'Session Information': 'chiefComplaint',
    'Behavioral Observations': 'objective',
    'Substance Use Update': 'reviewOfSystems',
    'Therapeutic Interventions': 'assessment',
    'Response to Treatment': 'objective',
    // Therapy extras
    'Emotions Tracked': 'subjective',
    'Urges & Behaviors': 'objective',
    'Skills Practiced': 'assessment',
    'Therapist Notes': 'plan',
    'Goals for Next Session': 'instructions',
    'Family Members Present': 'chiefComplaint',
    'Session Focus': 'subjective',
    'Family Dynamics Observed': 'objective',
    'Interventions Used': 'assessment',
    'Family Response': 'objective',
    'Clients Present': 'chiefComplaint',
    'Relational Dynamics': 'objective',
    'Couple Response': 'objective',
    'Goals & Plan': 'plan',
    // Physical / Occupational / Speech Therapy
    'Medical & Treatment History': 'historyOfPresentIllness',
    'Assessment Findings': 'objective',
    'Treatment Goals': 'plan',
    'Therapeutic Recommendations': 'instructions',
    'Progress Tracking': 'followUp',
    'Patient Goals': 'chiefComplaint',
    'Activities Addressed': 'subjective',
    'Functional Observations': 'objective',
    'Adaptive Strategies': 'assessment',
    'Progress Toward Goals': 'assessment',
    'Communication Goals': 'chiefComplaint',
    'Session Activities': 'subjective',
    'Articulation & Language Observations': 'objective',
    'Caregiver Education': 'instructions',
  };

  const getKey = (title: string): string =>
    sectionKeyMap[title] || title.replace(/[^a-zA-Z0-9]/g, '').replace(/^(.)/, (_, c) => c.toLowerCase());

  // Build the JSON schema example and per-section instructions
  const sectionInstructions = sections.map(s => {
    const key = getKey(s);
    return `- "${key}" ("${s}"): Write thorough, clinically comprehensive content for this section based on the transcription — target 120-250+ words where the visit supports it, with labeled subsections where clinically standard. Capture every relevant detail; do not summarize away specifics.`;
  }).join('\n');

  const jsonKeys = sections.map(s => `  "${getKey(s)}": "..."`).join(',\n');

  // Always include instructions if not already present
  const hasInstructions = sections.some(s =>
    s.toLowerCase().includes('instruction') || getKey(s) === 'instructions'
  );

  const templateName = templateId
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return `You are an expert medical documentation assistant.
Generate a comprehensive ${templateName} from the given patient-clinician transcription.

Return a JSON object with EXACTLY these fields plus a "topic" field:
{
  "topic": "...",
${jsonKeys}${hasInstructions ? '' : ',\n  "instructions": "..."'}
}

SECTION REQUIREMENTS:
${sectionInstructions}
${hasInstructions ? '' : '- "instructions": MANDATORY patient instructions — medications, activity, follow-up, warning signs.'}

IMPORTANT:
- Return ONLY valid JSON. Do NOT wrap in markdown code blocks.
- Use proper medical terminology throughout.
- Every section MUST contain real clinical content derived from the transcription.
- If the transcription doesn't mention something for a section, write reasonable clinical defaults or note "Not discussed during this encounter."
${DETAIL_INSTRUCTION}`;
}
/** The DETAIL_INSTRUCTION block shared by all prompts. Extracted so it can be reused. */
function getDetailInstruction(): string {
  return `
DEPTH AND COMPLETENESS (THE MOST IMPORTANT REQUIREMENT):
You are writing a complete, billable clinical document — not a summary. A clinician
reading ONLY your note (never the transcript) must be able to reconstruct the entire
visit. Write like a meticulous attending physician documenting for the medical record.
When in doubt, over-document — a longer, complete note is always preferred to a
shorter one. NEVER compress multiple findings into one sentence.

- STRICT LENGTH FLOOR: every major section must be AT LEAST 150 words when the visit
  contains relevant material for it, and 250+ words where the transcript is rich.
  Notes with thin sections are rejected as documentation failures.
- Capture EVERY clinically relevant datum from the transcription: every symptom,
  every medication (with dose/frequency when stated), every measurement, every
  timeline detail, every psychosocial factor, every instruction given. Omitting a
  detail that was discussed is a documentation error. Restate every number the
  transcript contains (doses, vitals, weights, durations, quantities).
- For each symptom, document the full characterization the transcript supports:
  onset, location, duration, character, aggravating/alleviating factors, radiation,
  timing, severity, and associated symptoms — EACH as its own explicit statement,
  plus every pertinent negative the clinician asked about (e.g. "Denies vomiting.
  Denies hematemesis. Denies melena.").
- History-type sections must also document, with labels, each of: past medical
  history, medications, allergies (state "not discussed" if absent), social history
  (tobacco/alcohol/caffeine/occupation as available), and family history — every one
  of these the transcript touches gets its own labeled line.
- Subjective/ROS-type sections must include a complete labeled Review of Systems
  block covering at least: Constitutional, Cardiovascular, Respiratory,
  Gastrointestinal, Genitourinary, Musculoskeletal, Neurological, Psychiatric, and
  Skin — marking each system with what was reported, what was denied, or
  "not assessed" if it never came up. Exam-type sections likewise include the full
  set of standard subsections for the specialty, with "not assessed during this
  visit" for the ones the clinician didn't examine.
- Structure EVERY section over 60 words with labeled subsections INSIDE the string,
  one per line, e.g. for an objective/exam section:
  "Vital Signs: BP 130/85 mmHg, HR 72 bpm, afebrile.\\nGeneral: Alert, well-appearing, in no acute distress.\\nCardiovascular: Regular rate and rhythm, no murmurs.\\nRespiratory: Lungs clear to auscultation bilaterally.\\nAbdomen: Soft, non-tender, no organomegaly."
  Include the standard subsections for the section type even when a given one was
  not assessed — write "not assessed during this visit" for it rather than omitting.
- Assessment sections must show clinical reasoning per problem, each on its own
  numbered line: the diagnosis (with ICD-10 when clearly supported), the specific
  supporting findings from THIS visit, the differential considered and why, and the
  risk factors that elevate concern.
- Plan sections must be organized per problem with numbered items, each with
  specific actions: medications (drug, dose, route, frequency, duration),
  diagnostics ordered with the reason, referrals with specialty and timeframe,
  patient education delivered, lifestyle modifications, and follow-up interval.
- NEVER fabricate specific values (vitals, lab results, doses) that were not stated.
  When something standard was not addressed, document it professionally within the
  structure (e.g. "Vital signs: not obtained during this visit") rather than
  inventing numbers or silently dropping the subsection.
- Use precise medical terminology; convert lay descriptions into clinical language
  (e.g. "feeling down" → "reports depressed mood").
- The "instructions" field is MANDATORY and must ALWAYS be included. It should contain:
  1. Medications prescribed with dosage, frequency, and duration
  2. Activity restrictions or modifications
  3. Diet or lifestyle recommendations
  4. Warning signs that require immediate medical attention
  5. Follow-up appointment timing
  6. Any referrals given
- Return ONLY valid JSON. Do NOT wrap in markdown code blocks.
- Every field value MUST be a single JSON string — NEVER a JSON array and NEVER a nested object. When a section uses bullet points, separate them with \\n characters inside the string, e.g. "• First point\\n• Second point".

ALWAYS INCLUDE A "topic" FIELD in the JSON output, in addition to all other required fields:
- "topic": A short, specific clinical title summarizing what THIS visit was about (4-8 words, Title Case).
  Good examples: "Leg and Headache Symptoms Evaluation", "Acute Upper Respiratory Infection Follow-Up",
  "Chest Pain Evaluation with Hypertension", "Postoperative Knee Replacement Review",
  "Type 2 Diabetes Management Visit".
  Rules: Do NOT include the patient's name. Do NOT start with "Patient" or "Visit for". Do NOT use generic
  titles like "Clinical Note" or "Medical Visit". Make it specific to the actual chief complaint and findings.

SPEAKER IDENTIFICATION (CRITICAL):
The transcription is from a recorded two-person conversation between a CLINICIAN and a PATIENT,
captured with a single microphone. Speakers are NOT labeled in the text.
You MUST use contextual clues to determine who is speaking at each point:
- Questions about symptoms, examination maneuvers, medical history inquiries → CLINICIAN speaking
- Descriptions of symptoms, personal concerns, pain reports, lifestyle details → PATIENT speaking
- Clinical instructions, prescriptions, referrals, follow-up plans → CLINICIAN speaking
- Confirmations like "yes", "no", "I understand" → use surrounding context to determine speaker

Apply this speaker identification when populating each section:
- "subjective" / "historyOfPresentIllness" / "chiefComplaint": capture ONLY what the PATIENT reported
- "objective" / "physicalExam": capture ONLY the CLINICIAN's examination findings and observations
- "assessment": the CLINICIAN's clinical reasoning and diagnoses
- "plan" / "instructions": the CLINICIAN's management decisions and patient education
Do NOT mix patient-reported symptoms into objective findings, and do NOT put clinician observations into the subjective section.
`;
}

/** Hand-written prompts for the 8 templates that have dedicated, specialty-specific prompts. */
function getDedicatedPrompts(DETAIL_INSTRUCTION: string): Record<string, string> {
  return {
    soap: `You are an expert medical documentation assistant specializing in thorough clinical documentation.
Generate a comprehensive SOAP note from the given patient-clinician transcription.

Return a JSON object with ALL of these REQUIRED fields:
{
  "subjective": "...",
  "objective": "...",
  "assessment": "...",
  "plan": "...",
  "instructions": "..."
}

Field requirements:
- "subjective": DETAILED patient history — include chief complaint, HPI (onset, location, duration, character, aggravating/alleviating factors, radiation, timing, severity), past medical/surgical history, medications, allergies, family history, social history, and review of systems. Must be thorough.
- "objective": COMPLETE physical examination — include vitals (BP, HR, RR, Temp, SpO2, weight), general appearance, and ALL body systems examined (HEENT, neck, cardiovascular, respiratory, abdomen, extremities, neurological, skin). Document both normal and abnormal findings.
- "assessment": Clinical impression with ICD-10 codes when possible. List all diagnoses (primary and secondary). Include clinical reasoning.
- "plan": Detailed management — medications with dosing, diagnostic workup ordered, referrals, patient education provided, disposition, and follow-up timeline.
- "instructions": MANDATORY comprehensive patient instructions — medications to take and how, activity level, diet, warning signs requiring emergency care, when to return, and any home care instructions.
${DETAIL_INSTRUCTION}`,

    psychiatry: `You are an expert psychiatric documentation assistant.
Generate a thorough psychiatric evaluation note from the transcription.

Return a JSON object with ALL of these REQUIRED fields:
{
  "chiefComplaint": "...",
  "historyOfPresentIllness": "...",
  "physicalExam": "...",
  "assessment": "...",
  "plan": "...",
  "instructions": "..."
}

Field requirements:
- "chiefComplaint": The presenting psychiatric concern in the patient's own words.
- "historyOfPresentIllness": Detailed psychiatric history — current episode (onset, duration, precipitants, symptom progression), past psychiatric history, hospitalizations, suicide attempts, medication trials, substance use history, trauma history.
- "physicalExam": Full Mental Status Exam — appearance, behavior, psychomotor activity, speech, mood (patient-stated), affect (observed), thought process, thought content (delusions, suicidal/homicidal ideation, hallucinations), cognition (orientation, memory, concentration), insight, and judgment.
- "assessment": Psychiatric diagnoses with DSM-5 criteria met, risk assessment (suicide, homicide, self-harm), and functional impairment level.
- "plan": Medication management with specific drugs/doses/changes, therapy type and frequency, safety plan, crisis resources, lab work, and follow-up schedule.
- "instructions": MANDATORY — medication instructions, crisis hotline numbers, safety plan steps, therapy homework, sleep hygiene, and when to seek emergency help.
${DETAIL_INSTRUCTION}`,

    therapy: `You are an expert therapy documentation assistant.
Generate a detailed therapy session note from the transcription.

Return a JSON object with ALL of these REQUIRED fields:
{
  "subjective": "...",
  "objective": "...",
  "assessment": "...",
  "plan": "...",
  "instructions": "..."
}

Field requirements:
- "subjective": Client's self-report — presenting concerns for this session, mood since last visit, life events, stressors, symptom changes, medication adherence, and between-session experiences.
- "objective": Therapist observations — client's appearance, affect, engagement level, speech, psychomotor behavior, therapeutic rapport, and response to interventions during the session.
- "assessment": Clinical progress — themes identified, treatment goal progress, therapeutic insights gained, risk factors assessed, diagnostic impressions, and functional status changes.
- "plan": Next session focus, treatment modifications, skills to develop, referrals, coordination of care, and updated treatment goals.
- "instructions": MANDATORY — between-session homework assignments, coping skills to practice, journaling prompts, mindfulness exercises, self-care recommendations, and emergency contacts.
${DETAIL_INSTRUCTION}`,

    pediatrics: `You are an expert pediatric documentation assistant.
Generate a thorough pediatric clinical note from the transcription.

Return a JSON object with ALL of these REQUIRED fields:
{
  "chiefComplaint": "...",
  "historyOfPresentIllness": "...",
  "physicalExam": "...",
  "assessment": "...",
  "plan": "...",
  "instructions": "..."
}

Field requirements:
- "chiefComplaint": Presenting symptom or concern as reported by parent/caregiver.
- "historyOfPresentIllness": Detailed symptom history — onset, duration, severity, associated symptoms, exposure history, feeding/sleeping changes, developmental milestones, birth history, immunization status, past medical history.
- "physicalExam": Age-appropriate exam — growth parameters (weight, height, head circumference with percentiles), vitals, general appearance, HEENT, lungs, heart, abdomen, skin, extremities, neurological, developmental assessment.
- "assessment": Diagnosis with clinical reasoning, differential diagnoses considered, growth assessment.
- "plan": Treatment plan — medications with weight-based dosing, follow-up timing, immunizations due, developmental screening, referrals.
- "instructions": MANDATORY caregiver instructions — medication administration (dose, frequency, how to give), fever management, hydration, activity level, dietary recommendations, warning signs requiring ER visit, return precautions.
${DETAIL_INSTRUCTION}`,

    cardiology: `You are an expert cardiology documentation assistant.
Generate a detailed cardiology consultation note from the transcription.

Return a JSON object with ALL of these REQUIRED fields:
{
  "chiefComplaint": "...",
  "historyOfPresentIllness": "...",
  "physicalExam": "...",
  "objective": "...",
  "assessment": "...",
  "plan": "...",
  "instructions": "..."
}

Field requirements:
- "chiefComplaint": Presenting cardiac symptoms.
- "historyOfPresentIllness": Detailed cardiac history — symptom description (chest pain characteristics, dyspnea class, palpitations, syncope), cardiac risk factors (HTN, DM, smoking, family hx, lipids), prior cardiac history, interventions, medications.
- "physicalExam": Cardiovascular examination — JVP, carotid pulses, PMI, heart sounds (S1, S2, murmurs, gallops), lung auscultation, peripheral edema, peripheral pulses.
- "objective": Diagnostic findings — ECG interpretation, echocardiogram results, stress test, cardiac catheterization, lab values (troponin, BNP, lipid panel).
- "assessment": Cardiac diagnosis, risk stratification, functional class.
- "plan": Medication management, lifestyle modifications, procedures planned, cardiac rehab, follow-up schedule.
- "instructions": MANDATORY — activity level and exercise recommendations, diet (sodium restriction, heart-healthy eating), medication compliance, weight monitoring, warning symptoms (chest pain, SOB, syncope requiring 911), follow-up appointments.
${DETAIL_INSTRUCTION}`,

    dermatology: `You are an expert dermatology documentation assistant.
Generate a detailed dermatology consultation note from the transcription.

Return a JSON object with ALL of these REQUIRED fields:
{
  "chiefComplaint": "...",
  "objective": "...",
  "physicalExam": "...",
  "assessment": "...",
  "plan": "...",
  "instructions": "..."
}

Field requirements:
- "chiefComplaint": Presenting skin concern — onset, duration, evolution, prior treatments, family history of skin conditions.
- "objective": Lesion description — morphology (macule, papule, plaque, nodule, vesicle), color, size in cm, surface characteristics (scaling, crusting, ulceration), border, symmetry.
- "physicalExam": Distribution and pattern — location, arrangement (grouped, linear, annular), extent, dermoscopic findings if applicable.
- "assessment": Dermatologic diagnosis with differential diagnoses, biopsy results if applicable.
- "plan": Treatment — topical medications with application instructions, systemic medications, procedures (biopsy, excision, cryotherapy), phototherapy, referrals.
- "instructions": MANDATORY — medication application technique, frequency, and duration; sun protection (SPF, clothing, avoidance); wound care; signs of infection; when to return; skincare routine modifications.
${DETAIL_INSTRUCTION}`,

    orthopedics: `You are an expert orthopedic documentation assistant.
Generate a detailed orthopedic consultation note from the transcription.

Return a JSON object with ALL of these REQUIRED fields:
{
  "chiefComplaint": "...",
  "historyOfPresentIllness": "...",
  "physicalExam": "...",
  "objective": "...",
  "assessment": "...",
  "plan": "...",
  "instructions": "..."
}

Field requirements:
- "chiefComplaint": Presenting musculoskeletal complaint.
- "historyOfPresentIllness": Mechanism of injury or symptom onset — timing, severity progression, prior injuries, prior treatments, functional limitations, occupation, sport participation.
- "physicalExam": Musculoskeletal exam — inspection, palpation, ROM (active and passive with degrees), strength testing (0-5 scale), neurovascular status (sensation, pulses, capillary refill), special tests (specific to the joint).
- "objective": Imaging findings — X-ray, MRI, CT interpretations with specific findings.
- "assessment": Orthopedic diagnosis, severity grading, stability assessment.
- "plan": Treatment — immobilization type, weight-bearing status, PT/OT referral, surgical planning if indicated, medications, follow-up imaging.
- "instructions": MANDATORY — weight-bearing restrictions, brace/cast care, icing protocol (20 min on/off), elevation, pain management (medications and schedule), exercises to perform, activities to avoid, signs of complications (increased swelling, numbness, color changes), follow-up timing.
${DETAIL_INSTRUCTION}`,

    custom: `You are an expert clinical documentation assistant.
Generate a comprehensive clinical note from the transcription.

Return a JSON object with ALL of these REQUIRED fields:
{
  "subjective": "...",
  "objective": "...",
  "assessment": "...",
  "plan": "...",
  "instructions": "..."
}

Field requirements:
- "subjective": Detailed patient history — chief complaint, HPI, past medical history, medications, allergies, social/family history, review of systems.
- "objective": Complete examination findings — vitals and all relevant systems examined with both normal and abnormal findings documented.
- "assessment": Clinical diagnoses with reasoning, differential diagnoses, and clinical impression.
- "plan": Treatment plan — medications, diagnostics, referrals, and follow-up schedule.
- "instructions": MANDATORY patient instructions — medications, activity modifications, warning signs, diet, follow-up, and when to seek emergency care.
${DETAIL_INSTRUCTION}`,

    default: `You are an expert clinical documentation assistant. Generate a thorough clinical note from the transcription.
Return a JSON object with these REQUIRED fields: subjective, objective, assessment, plan, instructions.
Each field must contain detailed, multi-sentence content. The 'instructions' field is MANDATORY — always include specific patient instructions for medications, activity, follow-up, and warning signs.
${DETAIL_INSTRUCTION}`,
  };
}


function generateMockTranscription(): string {
  return `Patient presents today for follow-up regarding their hypertension. 
They report compliance with medication regimen. Blood pressure readings at home have been averaging 135/85. 
Patient denies any headaches, chest pain, or shortness of breath. 
They have been following a low-sodium diet and exercising three times per week.
Physical examination reveals blood pressure of 138/88, heart rate 72, regular rhythm.
Heart sounds normal, no murmurs. Lungs clear bilaterally.
Assessment: Hypertension, controlled on current regimen.
Plan: Continue current medications, follow up in three months, continue lifestyle modifications.`;
}

function generateMockNoteContent(template: string, patientName: string): Record<string, string> {
  const name = patientName || 'Patient';

  const contents: Record<string, Record<string, string>> = {
    soap: {
      subjective: `${name} presents for follow-up. Reports compliance with treatment plan. No new complaints at this time.`,
      objective: `Vital signs within normal limits. Physical examination unremarkable. Patient appears well.`,
      assessment: `Condition stable on current management. No acute issues identified.`,
      plan: `Continue current treatment. Follow up as scheduled. Return precautions discussed.`,
      instructions: `Take all medications as prescribed. Follow the low-sodium diet and exercise recommendations discussed today. Monitor blood pressure daily and record readings. Return to the clinic in 3 months or sooner if you experience chest pain, severe headache, shortness of breath, or dizziness. Call the office if you have any questions about your medications.`,
    },
    psychiatry: {
      chiefComplaint: `${name} presents for psychiatric evaluation.`,
      historyOfPresentIllness: `Patient describes symptoms and current mental health status. Treatment history reviewed.`,
      mentalStatusExam: `Alert and oriented x4. Appearance: Well-groomed. Behavior: Cooperative. Mood: "Okay". Affect: Appropriate, full range. Thought Process: Linear, goal-directed. Thought Content: No SI/HI, no delusions. Cognition: Intact. Insight: Good. Judgment: Good.`,
      assessment: `Clinical assessment based on evaluation findings.`,
      plan: `Treatment recommendations and follow-up plan.`,
      instructions: `Take prescribed medications daily as directed — do not stop without consulting your provider. Attend all scheduled therapy appointments. If you experience thoughts of harming yourself or others, call 988 (Suicide & Crisis Lifeline) or go to the nearest emergency room immediately. Follow up in 4 weeks or sooner if symptoms worsen.`,
    },
    therapy: {
      sessionSummary: `Therapy session with ${name}. Topics discussed include current stressors and coping strategies.`,
      clientPresentation: `Patient presented as engaged and motivated for treatment.`,
      interventionsUsed: `Cognitive restructuring, behavioral activation, and mindfulness techniques.`,
      clientResponse: `Patient demonstrated good insight and receptiveness to interventions.`,
      progressNotes: `Progress toward treatment goals noted. Areas for continued work identified.`,
      plan: `Continue weekly sessions. Homework assigned. Skills practice between sessions.`,
      instructions: `Practice the breathing exercises daily for 5–10 minutes. Complete the thought journal between sessions. Continue behavioral activation activities — aim for at least one enjoyable activity per day. If you feel overwhelmed, use the grounding techniques we practiced. Contact the office or crisis line if you feel unsafe.`,
    },
    pediatrics: {
      chiefComplaint: `${name} presents for pediatric evaluation.`,
      historyOfPresentIllness: `Parent/guardian reports current symptoms and timeline.`,
      developmentalHistory: `Developmental milestones appropriate for age. Immunizations up to date.`,
      physicalExam: `General: Active, alert child in no acute distress. HEENT: Normal. Lungs: Clear. Heart: RRR, no murmurs. Abdomen: Soft, non-tender. Extremities: Normal range of motion.`,
      assessment: `Clinical assessment based on age-appropriate evaluation.`,
      plan: `Treatment plan and anticipatory guidance provided. Follow-up as indicated.`,
      instructions: `Give all medications exactly as prescribed — do not skip doses. Encourage fluids and rest. Keep your child home from school until fever-free for 24 hours without medication. Return to the ER immediately if your child develops difficulty breathing, persistent high fever (>104°F), severe vomiting, or seems very unwell. Follow up in 2–3 days or as directed.`,
    },
    cardiology: {
      chiefComplaint: `${name} presents for cardiology consultation.`,
      cardiacHistory: `Cardiac risk factors and history reviewed. Family history of cardiac disease assessed.`,
      physicalExam: `BP: Normal. HR: Regular rate and rhythm. JVP: Not elevated. Heart: S1, S2 normal, no murmurs, rubs, or gallops. Lungs: Clear. Extremities: No edema, pulses intact.`,
      diagnosticFindings: `ECG: Normal sinus rhythm. Echocardiogram findings pending/reviewed.`,
      assessment: `Cardiac assessment based on clinical evaluation and diagnostics.`,
      plan: `Cardiology recommendations and follow-up plan.`,
      instructions: `Take cardiac medications at the same time every day — never skip or double doses. Follow a heart-healthy, low-sodium diet. Limit physical exertion until cleared. Call 911 immediately or go to the ER for chest pain, pressure, palpitations, severe shortness of breath, or fainting. Follow up with cardiology in 4–6 weeks.`,
    },
    dermatology: {
      chiefComplaint: `${name} presents for dermatology evaluation.`,
      lesionDescription: `Description of primary lesion morphology, color, size, and surface characteristics.`,
      distribution: `Location and pattern of skin findings documented.`,
      associatedSymptoms: `Pruritus, pain, or other associated symptoms noted.`,
      assessment: `Dermatologic diagnosis based on clinical presentation.`,
      plan: `Treatment recommendations including topical/systemic therapy. Follow-up for response to treatment.`,
      instructions: `Apply the prescribed topical medication to affected areas as directed — avoid eyes and mucous membranes. Do not scratch or pick at lesions. Use gentle, fragrance-free soap and moisturizer daily. Apply broad-spectrum SPF 30+ sunscreen when outdoors. Return if the rash spreads, becomes infected (increasing redness, warmth, pus), or does not improve in 2–4 weeks.`,
    },
    orthopedics: {
      chiefComplaint: `${name} presents for orthopedic evaluation.`,
      injuryMechanism: `Mechanism of injury or onset of symptoms described.`,
      physicalExam: `Inspection: No obvious deformity. Palpation: Point tenderness noted. ROM: Range of motion assessed. Strength: Motor strength testing performed. Neurovascular: Intact sensation and pulses. Special Tests: Relevant orthopedic tests performed.`,
      imagingFindings: `X-ray/MRI findings reviewed or pending.`,
      assessment: `Orthopedic diagnosis and clinical impression.`,
      plan: `Treatment plan including activity modifications, physical therapy, and follow-up.`,
      instructions: `Rest and protect the injured area — avoid activities that cause pain. Apply ice for 20 minutes several times daily for the first 48–72 hours. Keep the extremity elevated when possible. Take prescribed pain medications as directed with food. Do not bear weight on the injured limb unless cleared. Go to the ER immediately if you develop increasing numbness, inability to move the area, severe swelling, or the limb changes color. Follow up in 1–2 weeks.`,
    },
    custom: {
      subjective: `${name} presents for evaluation. Chief complaint and history documented.`,
      objective: `Physical examination and relevant findings documented.`,
      assessment: `Clinical assessment and diagnosis.`,
      plan: `Treatment plan and follow-up recommendations.`,
      instructions: `Follow all treatment instructions as discussed. Take medications as prescribed. Attend all follow-up appointments. Contact the office with any questions or concerns. Go to the emergency room or call 911 if you experience a medical emergency or sudden worsening of symptoms.`,
      additionalNotes: `Additional relevant clinical information.`,
    },
  };

  return contents[template.toLowerCase()] || contents.soap;
}

export default router;
