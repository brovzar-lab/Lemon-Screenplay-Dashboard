import { useAuthStore } from '@/stores/authStore';
import { LocalGoogleSignInButton } from './LocalGoogleSignInButton';

export function LoginScreen() {
  const signIn = useAuthStore((state) => state.signIn);
  const isSigningIn = useAuthStore((state) => state.isSigningIn);
  const error = useAuthStore((state) => state.error);
  const isLocalReview =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  return (
    <main className="login-screen min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--sp-bg)' }}>
      <section className="w-full max-w-sm text-center" aria-labelledby="login-title">
        <img src="/lemon-logo-black.png" alt="Lemon Studios" className="w-20 h-20 mx-auto mb-6" />
        <h1 id="login-title" className="text-3xl font-display mb-2" style={{ color: 'var(--sp-text)' }}>
          Screenplay Dashboard
        </h1>
        <p className="mb-8 text-sm" style={{ color: 'var(--sp-text-3)' }}>
          {isLocalReview
            ? 'Open the local review build using the verified Lemon Studios account on this Mac.'
            : 'Sign in with your Lemon Studios account. Google will open securely in this window and return you here.'}
        </p>

        {isLocalReview ? (
          <LocalGoogleSignInButton />
        ) : (
          <button
            type="button"
            onClick={() => void signIn()}
            disabled={isSigningIn}
            className="btn btn-primary w-full min-h-[48px] justify-center"
          >
            {isSigningIn ? 'Signing in...' : 'Continue with Google'}
          </button>
        )}

        {isLocalReview && isSigningIn && (
          <p className="mt-3 text-sm" style={{ color: 'var(--sp-text-3)' }}>
            Verifying your Lemon Studios account...
          </p>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm" style={{ color: 'var(--sp-pass)' }}>
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
