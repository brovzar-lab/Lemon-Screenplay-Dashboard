import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExportModal } from './ExportModal';

// Suppress console.error noise from @react-pdf/renderer in test env
vi.mock('@react-pdf/renderer', () => ({
  pdf: vi.fn(),
  Document: ({ children }: any) => children,
  Page: ({ children }: any) => children,
  View: ({ children }: any) => children,
  Text: ({ children }: any) => children,
  StyleSheet: { create: (s: any) => s },
}));

vi.mock('./PdfDocument', () => ({
  PdfDocument: () => null,
}));

vi.mock('./csvExport', () => ({
  exportToCSV: vi.fn(),
}));

vi.mock('@/stores/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: vi.fn() }) },
}));

function makeScreenplays(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    title: `Screenplay ${i + 1}`,
    recommendation: 'pass' as const,
  }));
}

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
};

describe('BULK-03 export scope confirmation', () => {
  it("'selected' mode shows \"Exporting X selected screenplays\"", () => {
    const fiveScreenplays = makeScreenplays(5);
    render(
      <ExportModal
        {...baseProps}
        mode="selected"
        screenplays={fiveScreenplays as any[]}
      />
    );
    expect(screen.getByText(/Exporting 5 selected screenplays/i)).toBeInTheDocument();
  });

  it("'all' mode shows \"Exporting all X screenplays\"", () => {
    const tenScreenplays = makeScreenplays(10);
    render(
      <ExportModal
        {...baseProps}
        mode="all"
        screenplays={tenScreenplays as any[]}
      />
    );
    expect(screen.getByText(/Exporting all 10 screenplays/i)).toBeInTheDocument();
  });

  it("'filtered' mode shows \"Exporting X filtered screenplays\"", () => {
    const threeScreenplays = makeScreenplays(3);
    render(
      <ExportModal
        {...baseProps}
        mode="filtered"
        screenplays={threeScreenplays as any[]}
      />
    );
    expect(screen.getByText(/Exporting 3 filtered screenplays/i)).toBeInTheDocument();
  });

  it('export button label shows count: "Export N Screenplays"', () => {
    const sevenScreenplays = makeScreenplays(7);
    render(
      <ExportModal
        {...baseProps}
        mode="selected"
        screenplays={sevenScreenplays as any[]}
      />
    );
    expect(screen.getByRole('button', { name: /Export 7 Screenplays/i })).toBeInTheDocument();
  });
});
