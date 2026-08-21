import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { LoginScreen } from '@/components/auth/LoginScreen';

const authState = vi.hoisted(() => ({
  error: 'auth.error.generic',
  isSigningIn: false,
  signIn: vi.fn(),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: typeof authState) => unknown) => selector(authState),
}));

vi.mock('@/components/auth/LocalGoogleSignInButton', () => ({
  LocalGoogleSignInButton: () => <button type="button">Local sign-in</button>,
}));

describe('LoginScreen errors', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('renders a safe translated application error', async () => {
    await i18n.changeLanguage('es');
    render(<LoginScreen />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se pudo iniciar sesión. Intenta de nuevo.',
    );
    expect(screen.queryByText(/firebase/i)).not.toBeInTheDocument();
  });
});
