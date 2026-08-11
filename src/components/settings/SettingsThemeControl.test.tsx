import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useThemeStore } from '@/stores/themeStore';
import { SettingsThemeControl } from './SettingsThemeControl';

describe('SettingsThemeControl', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useThemeStore.getState().setDesignSystem('instrument');
    useThemeStore.getState().setTheme('light');
  });

  it('offers light, dark, and system modes through the existing persisted theme store', async () => {
    const user = userEvent.setup();
    render(<SettingsThemeControl />);

    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Dark' }));
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');

    await user.click(screen.getByRole('button', { name: 'System' }));
    expect(useThemeStore.getState().theme).toBe('system');
    expect(window.localStorage.getItem('lemon-theme')).toContain('"theme":"system"');
  });
});
