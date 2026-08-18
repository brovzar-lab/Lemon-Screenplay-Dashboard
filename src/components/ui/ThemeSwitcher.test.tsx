import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';
import { useThemeStore } from '@/stores/themeStore';

describe('ThemeSwitcher', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useThemeStore.getState().setTheme('light');
    useThemeStore.getState().setDesignSystem('instrument');
  });

  it('switches to Lemon Signal and saves the choice', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);

    await user.click(screen.getByRole('button', { name: 'Switch design system' }));
    await user.click(screen.getByRole('option', { name: /Lemon Signal/ }));

    expect(useThemeStore.getState().designSystem).toBe('signal');
    expect(document.documentElement).toHaveAttribute('data-theme', 'signal');
    expect(window.localStorage.getItem('lemon-theme')).toContain('"designSystem":"signal"');
  });
});
