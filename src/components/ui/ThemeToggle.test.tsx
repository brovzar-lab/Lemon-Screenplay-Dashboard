import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useThemeStore } from '@/stores/themeStore';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useThemeStore.getState().setDesignSystem('instrument');
    useThemeStore.getState().setTheme('light');
  });

  it('uses the existing theme store and persists the selected mode', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole('button', { name: 'Toggle theme' }));

    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(window.localStorage.getItem('lemon-theme')).toContain('"theme":"dark"');
  });
});
