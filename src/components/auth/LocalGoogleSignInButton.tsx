import { useAuthStore } from '@/stores/authStore';
import { useTranslation } from 'react-i18next';

export function LocalGoogleSignInButton() {
  const { t } = useTranslation();
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
        {isSigningIn ? t('Opening local review...') : t('Continue as Billy')}
      </button>
      <p className="mt-3 text-xs" style={{ color: 'var(--sp-text-3)' }}>
        {t('Local review on this Mac only')}
      </p>
    </div>
  );
}
