import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const settingsCss = readFileSync(join(process.cwd(), 'src/pages/settings-page.css'), 'utf8');
const calibrationPanel = readFileSync(
  join(process.cwd(), 'src/components/settings/CalibrationPanel.tsx'),
  'utf8',
);

describe('Settings visual token contract', () => {
  it('maps legacy panels to shared theme surfaces, text, and borders', () => {
    expect(settingsCss).toContain('--settings-paper: var(--sp-surface);');
    expect(settingsCss).toContain('--settings-paper-muted: var(--sp-surface-2);');
    expect(settingsCss).toContain('--settings-ink-2: var(--sp-text-2);');
    expect(settingsCss).toContain('--settings-line: var(--sp-border);');
    expect(settingsCss).toMatch(
      /\.settings-panel \[class\*='bg-black-950'\][\s\S]*background-color: var\(--settings-paper-muted\) !important;/,
    );
    expect(settingsCss).toMatch(
      /\.settings-panel \[class\*='text-black-500'\][\s\S]*color: var\(--settings-ink-2\) !important;/,
    );
  });

  it('keeps the calibration panel on semantic Settings tokens', () => {
    expect(calibrationPanel).not.toContain('#3157d5');
    expect(calibrationPanel).toContain('var(--settings-cobalt)');
    expect(calibrationPanel).toContain('var(--settings-paper-muted)');
    expect(calibrationPanel).toContain('var(--settings-line)');
  });
});
