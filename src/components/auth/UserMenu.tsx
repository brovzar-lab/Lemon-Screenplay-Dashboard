import { useAuthStore } from '@/stores/authStore';

export function UserMenu() {
  const profile = useAuthStore((state) => state.profile);
  const signOut = useAuthStore((state) => state.signOut);
  if (!profile) return null;

  const initial = (profile.displayName || profile.email).charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-2">
      {profile.photoURL ? (
        <img src={profile.photoURL} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
      ) : (
        <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold" style={{ background: 'var(--sp-accent-soft)', color: 'var(--sp-accent)' }}>
          {initial}
        </span>
      )}
      <button
        type="button"
        onClick={() => void signOut()}
        className="p-2 rounded-lg"
        style={{ color: 'var(--sp-text-3)' }}
        title={`Sign out ${profile.email}`}
        aria-label="Sign out"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
        </svg>
      </button>
    </div>
  );
}
