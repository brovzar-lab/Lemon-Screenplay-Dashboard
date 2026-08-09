import { useEffect, useRef, useState } from 'react';
import { GOOGLE_WEB_CLIENT_ID, LEMON_EMAIL_DOMAIN } from '@/lib/firebase';
import { useAuthStore } from '@/stores/authStore';

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdentityApi {
  initialize: (configuration: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    hd: string;
    auto_select: boolean;
    cancel_on_tap_outside: boolean;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      type: 'standard';
      theme: 'outline';
      size: 'large';
      text: 'continue_with';
      shape: 'rectangular';
      logo_alignment: 'left';
      width: number;
    },
  ) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleIdentityApi;
      };
    };
  }
}

const GOOGLE_IDENTITY_SCRIPT_ID = 'google-identity-services';
const GOOGLE_IDENTITY_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

function loadGoogleIdentityServices(): Promise<GoogleIdentityApi> {
  if (window.google?.accounts.id) {
    return Promise.resolve(window.google.accounts.id);
  }

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(
      GOOGLE_IDENTITY_SCRIPT_ID,
    ) as HTMLScriptElement | null;
    const script = existing ?? document.createElement('script');

    const handleLoad = () => {
      if (window.google?.accounts.id) {
        resolve(window.google.accounts.id);
        return;
      }
      reject(new Error('Google sign-in did not initialize.'));
    };
    const handleError = () => reject(new Error('Google sign-in could not load.'));

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });

    if (!existing) {
      script.id = GOOGLE_IDENTITY_SCRIPT_ID;
      script.src = GOOGLE_IDENTITY_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });
}

export function LocalGoogleSignInButton() {
  const buttonHostRef = useRef<HTMLDivElement>(null);
  const signInWithIdToken = useAuthStore((state) => state.signInWithIdToken);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void loadGoogleIdentityServices()
      .then((identity) => {
        if (cancelled || !buttonHostRef.current) return;

        identity.initialize({
          client_id: GOOGLE_WEB_CLIENT_ID,
          callback: (response) => {
            if (!response.credential) {
              setLoadError('Google did not return a sign-in credential.');
              return;
            }
            void signInWithIdToken(response.credential);
          },
          hd: LEMON_EMAIL_DOMAIN,
          auto_select: false,
          cancel_on_tap_outside: false,
        });

        buttonHostRef.current.replaceChildren();
        identity.renderButton(buttonHostRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: Math.round(buttonHostRef.current.getBoundingClientRect().width),
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(
          error instanceof Error ? error.message : 'Google sign-in could not load.',
        );
      });

    return () => {
      cancelled = true;
    };
  }, [signInWithIdToken]);

  return (
    <div>
      <div
        ref={buttonHostRef}
        className="min-h-[44px] w-full overflow-hidden rounded-md"
        aria-label="Continue with Google"
      />
      {loadError && (
        <p role="alert" className="mt-3 text-sm" style={{ color: 'var(--sp-pass)' }}>
          {loadError}
        </p>
      )}
    </div>
  );
}
