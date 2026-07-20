import { useAuthStore } from '@/stores/authStore';

export function LoginScreen() {
  const signIn = useAuthStore((state) => state.signIn);
  const isSigningIn = useAuthStore((state) => state.isSigningIn);
  const error = useAuthStore((state) => state.error);

  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--sp-bg)' }}>
      <section className="w-full max-w-sm text-center" aria-labelledby="login-title">
        <img src="/lemon-logo-black.png" alt="Lemon Studios" className="w-20 h-20 mx-auto mb-6" />
        <h1 id="login-title" className="text-3xl font-display mb-2" style={{ color: 'var(--sp-text)' }}>
          Screenplay Dashboard
        </h1>
        <p className="mb-8 text-sm" style={{ color: 'var(--sp-text-3)' }}>
          Sign in with your Lemon Studios account.
        </p>

        <button
          type="button"
          onClick={() => void signIn()}
          disabled={isSigningIn}
          className="btn btn-primary w-full min-h-[48px] justify-center"
        >
          {isSigningIn ? 'Signing in...' : 'Continue with Google'}
        </button>

        {error && (
          <p role="alert" className="mt-4 text-sm" style={{ color: 'var(--sp-pass)' }}>
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
