import { useAuthStore } from '@/stores/authStore';

export function LocalGoogleSignInButton() {
  const signInLocalReview = useAuthStore((state) => state.signInLocalReview);
  const isSigningIn = useAuthStore((state) => state.isSigningIn);

  return (
    <div>
      <button
        type="button"
        onClick={() => void signInLocalReview()}
        disabled={isSigningIn}
        className="btn btn-primary w-full min-h-[48px] justify-center"
      >
        {isSigningIn ? 'Opening local review...' : 'Continue as Billy'}
      </button>
      <p className="mt-3 text-xs" style={{ color: 'var(--sp-text-3)' }}>
        Local review on this Mac only
      </p>
    </div>
  );
}
