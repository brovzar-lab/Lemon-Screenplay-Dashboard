import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { PasswordGate } from './PasswordGate';

describe('PasswordGate accessibility', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('gives the four PIN fields distinct accessible names', async () => {
    render(
      <PasswordGate storageKey="accessibility-test">
        <div>Protected settings</div>
      </PasswordGate>,
    );

    expect(await screen.findByRole('group', { name: 'Create settings PIN' })).toBeInTheDocument();
    for (let digit = 1; digit <= 4; digit += 1) {
      expect(
        screen.getByLabelText(`Create settings PIN, digit ${digit} of 4`),
      ).toBeInTheDocument();
    }
  });
});
