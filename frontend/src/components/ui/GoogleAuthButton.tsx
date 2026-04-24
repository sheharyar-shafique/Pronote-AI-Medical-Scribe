import { useEffect, useRef, useState } from 'react';

interface GoogleAuthButtonProps {
  onSuccess: (idToken: string) => void;
  onError?: (error: string) => void;
  label?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: object) => void;
          renderButton: (element: HTMLElement, options: object) => void;
          prompt: () => void;
        };
      };
    };
    handleGoogleCredential?: (response: { credential: string }) => void;
  }
}

export default function GoogleAuthButton({ onSuccess, onError, label = 'Continue with Google' }: GoogleAuthButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

  useEffect(() => {
    if (!clientId) return;

    // Expose callback globally (GSI requires this)
    window.handleGoogleCredential = (response: { credential: string }) => {
      setLoading(true);
      onSuccess(response.credential);
    };

    const existingScript = document.getElementById('google-gsi-script');
    if (existingScript) {
      initGoogle();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.id = 'google-gsi-script';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setLoaded(true);
      initGoogle();
    };
    script.onerror = () => {
      onError?.('Failed to load Google Sign-In');
    };
    document.head.appendChild(script);

    return () => {
      // Don't remove — other pages might need it
    };
  }, [clientId]);

  function initGoogle() {
    if (!window.google || !buttonRef.current || !clientId) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: window.handleGoogleCredential,
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: 'filled_black',
      size: 'large',
      width: buttonRef.current.offsetWidth || 400,
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'left',
    });
  }

  if (!clientId) {
    return (
      <div className="w-full py-3.5 px-4 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center gap-3 text-white/30 text-sm cursor-not-allowed">
        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Google Sign-In not configured
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* GSI renders into this div */}
      <div
        ref={buttonRef}
        className="w-full overflow-hidden rounded-xl"
        style={{ minHeight: '44px' }}
      />
      {/* Fallback styled button while GSI loads */}
      {!loaded && !window.google && (
        <button
          type="button"
          disabled
          className="w-full py-3.5 px-4 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center gap-3 text-white/60 text-sm"
        >
          <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          Loading Google Sign-In...
        </button>
      )}
    </div>
  );
}
