import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { LoginScreen } from './LoginScreen';

interface AuthGateProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

function AuthLoading() {
  return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: 'var(--sp-bg)' }}>
      <div className="text-center" role="status">
        <div className="w-8 h-8 mx-auto mb-3 rounded-full border-2 border-current border-t-transparent animate-spin" style={{ color: 'var(--sp-accent)' }} />
        <p className="text-sm" style={{ color: 'var(--sp-text-3)' }}>Opening Lemon Studios...</p>
      </div>
    </main>
  );
}

export function AuthGate({ children, requireAdmin = false }: AuthGateProps) {
  const initialize = useAuthStore((state) => state.initialize);
  const status = useAuthStore((state) => state.status);
  const role = useAuthStore((state) => state.profile?.role);

  useEffect(() => initialize(), [initialize]);

  if (status === 'initializing' || status === 'loading_profile') return <AuthLoading />;
  if (status === 'signed_out') return <LoginScreen />;

  if (requireAdmin && role !== 'admin') {
    return (
      <main className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--sp-bg)' }}>
        <section className="text-center max-w-md">
          <h1 className="text-2xl font-display mb-3" style={{ color: 'var(--sp-text)' }}>Admin access required</h1>
          <p className="mb-6 text-sm" style={{ color: 'var(--sp-text-3)' }}>
            Your reader account can review, annotate, compare, export, and share screenplays.
          </p>
          <Link to="/" className="btn btn-primary">Back to Dashboard</Link>
        </section>
      </main>
    );
  }

  return children;
}
