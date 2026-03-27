import { describe, it, expect } from 'vitest';
import type { Screenplay } from '@/types';
import {
  validatePdfFile,
  validationMessage,
  matchScore,
  matchFilesToScreenplays,
  middleTruncate,
  MAX_FILE_SIZE,
  MATCH_THRESHOLD,
} from './bulkPdfUpload.helpers';

// Helper to create mock File objects
function mockFile(
  name: string,
  options: { type?: string; sizeBytes?: number } = {}
): File {
  const { type = 'application/pdf', sizeBytes = 1024 } = options;
  const content = new Uint8Array(sizeBytes > 0 ? Math.min(sizeBytes, 64) : 0);
  const file = new File([content], name, { type });
  // Override size since File content size may differ from desired sizeBytes
  if (sizeBytes !== content.length) {
    Object.defineProperty(file, 'size', { value: sizeBytes });
  }
  return file;
}

// Helper to create minimal Screenplay mocks
function mockScreenplay(overrides: Partial<Screenplay>): Screenplay {
  return {
    id: '1',
    title: 'Untitled',
    sourceFile: 'untitled.json',
    ...overrides,
  } as Screenplay;
}

describe('validatePdfFile', () => {
  it('returns null for a valid PDF file', () => {
    const file = mockFile('script.pdf', { type: 'application/pdf' });
    expect(validatePdfFile(file)).toBeNull();
  });

  it('returns "not-pdf" for a text/plain file', () => {
    const file = mockFile('readme.txt', { type: 'text/plain' });
    expect(validatePdfFile(file)).toBe('not-pdf');
  });

  it('returns "not-pdf" for a .docx file with no PDF extension or MIME', () => {
    const file = mockFile('script.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    expect(validatePdfFile(file)).toBe('not-pdf');
  });

  it('returns "too-large" for a file over 50MB', () => {
    const file = mockFile('huge.pdf', {
      type: 'application/pdf',
      sizeBytes: 51 * 1024 * 1024,
    });
    expect(validatePdfFile(file)).toBe('too-large');
  });

  it('accepts a .pdf file even with empty MIME type', () => {
    const file = mockFile('script.pdf', { type: '' });
    expect(validatePdfFile(file)).toBeNull();
  });

  it('exports MAX_FILE_SIZE as 50MB', () => {
    expect(MAX_FILE_SIZE).toBe(50 * 1024 * 1024);
  });

  it('exports MATCH_THRESHOLD as 50', () => {
    expect(MATCH_THRESHOLD).toBe(50);
  });
});

describe('validationMessage', () => {
  it('returns "PDF files only" for "not-pdf"', () => {
    expect(validationMessage('not-pdf')).toBe('PDF files only');
  });

  it('returns message with "max 50MB" for "too-large"', () => {
    const msg = validationMessage('too-large');
    expect(msg).toContain('max 50MB');
    expect(msg).toContain('too large');
  });

  it('returns empty string for null (valid)', () => {
    expect(validationMessage(null)).toBe('');
  });
});

describe('matchScore', () => {
  const matrix = mockScreenplay({
    id: '1',
    title: 'The Matrix',
    sourceFile: 'the_matrix_v2.json',
  });

  it('returns 100 for exact title match (case-insensitive)', () => {
    expect(matchScore('the matrix.pdf', matrix)).toBe(100);
  });

  it('returns 100 for exact title match ignoring underscores', () => {
    expect(matchScore('The_Matrix.pdf', matrix)).toBe(100);
  });

  it('returns 100 for exact sourceFile match', () => {
    expect(matchScore('the_matrix_v2.json', matrix)).toBe(100);
  });

  it('returns 80 when dropped name contains the full title as substring', () => {
    expect(matchScore('The Matrix Reloaded.pdf', matrix)).toBe(80);
  });

  it('returns 80 when title contains the full dropped name as substring', () => {
    const longTitle = mockScreenplay({
      id: '2',
      title: 'The Matrix Revolutions Extended',
      sourceFile: 'matrix_rev.json',
    });
    expect(matchScore('The Matrix Revolutions.pdf', longTitle)).toBe(80);
  });

  it('returns 70 for sourceFile substring match', () => {
    // Use a screenplay where the sourceFile is a PDF (so .pdf gets stripped by normalize)
    // and the dropped name is a substring of the sourceFile
    const sp = mockScreenplay({
      id: '3',
      title: 'Untitled Sci-Fi',
      sourceFile: 'the_matrix_v2_final_cut.pdf',
    });
    // dropped: "the matrix v2" (subset of sourceFile normalized: "the matrix v2 final cut")
    expect(matchScore('the_matrix_v2.pdf', sp)).toBe(70);
  });

  it('returns value between 25-60 for word overlap matches', () => {
    const score = matchScore('Matrix_Something.pdf', matrix);
    expect(score).toBeGreaterThanOrEqual(25);
    expect(score).toBeLessThanOrEqual(60);
  });

  it('returns 0 for completely unrelated names', () => {
    expect(matchScore('avengers_endgame.pdf', matrix)).toBe(0);
  });
});

describe('matchFilesToScreenplays', () => {
  const screenplays = [
    mockScreenplay({
      id: 'sp-1',
      title: 'The Matrix',
      sourceFile: 'the_matrix.json',
    }),
    mockScreenplay({
      id: 'sp-2',
      title: 'Inception',
      sourceFile: 'inception.json',
    }),
  ];

  it('matches 2 files to 2 screenplays correctly by best score', () => {
    const files = [
      mockFile('The_Matrix.pdf'),
      mockFile('inception.pdf'),
    ];
    const result = matchFilesToScreenplays(files, screenplays);
    expect(result.matched).toHaveLength(2);
    expect(result.unmatched).toHaveLength(0);
    expect(result.matched[0].screenplay.id).toBe('sp-1');
    expect(result.matched[1].screenplay.id).toBe('sp-2');
  });

  it('returns unmatched files when score below MATCH_THRESHOLD', () => {
    const files = [mockFile('completely_random_name.pdf')];
    const result = matchFilesToScreenplays(files, screenplays);
    expect(result.matched).toHaveLength(0);
    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0].name).toBe('completely_random_name.pdf');
  });

  it('does not double-assign one screenplay to two files', () => {
    const files = [
      mockFile('The_Matrix.pdf'),
      mockFile('The_Matrix_v2.pdf'),
    ];
    const result = matchFilesToScreenplays(files, screenplays);
    // First file should match The Matrix, second should either match something else or be unmatched
    const matchedIds = result.matched.map((m) => m.screenplay.id);
    const uniqueIds = new Set(matchedIds);
    expect(matchedIds.length).toBe(uniqueIds.size);
  });
});

describe('middleTruncate', () => {
  it('returns input unchanged when length <= maxLength', () => {
    expect(middleTruncate('short.pdf', 20)).toBe('short.pdf');
  });

  it('returns input unchanged when length equals maxLength exactly', () => {
    const text = 'exactly_twenty_chars'; // 20 chars
    expect(middleTruncate(text, 20)).toBe(text);
  });

  it('truncates with ellipsis in the middle for long strings', () => {
    const result = middleTruncate('El_Godin_de_los_Suenos_V4_FINAL.pdf', 30);
    expect(result.length).toBe(30);
    expect(result).toContain('\u2026'); // ellipsis character
  });

  it('preserves start and end of the filename', () => {
    const input = 'El_Godin_de_los_Suenos_V4_FINAL.pdf';
    const result = middleTruncate(input, 30);
    // 30 chars total: 29 visible + 1 ellipsis char
    // front = ceil(29 * 0.6) = 18, back = floor(29 * 0.4) = 11
    // Should start with the beginning of the filename
    expect(result.startsWith('El_Godin_de_los_Su')).toBe(true);
    // Should end with the extension part (11 chars from end)
    expect(result.endsWith('4_FINAL.pdf')).toBe(true);
  });

  it('places ellipsis with 60/40 split (more at start)', () => {
    const input = 'A_Very_Long_Filename_That_Goes_On_And_On.pdf';
    const result = middleTruncate(input, 25);
    const ellipsisIndex = result.indexOf('\u2026');
    // Front portion should be ~60% of available chars (24 chars minus ellipsis = 24)
    // 60% of 24 = ~14-15 chars
    expect(ellipsisIndex).toBeGreaterThanOrEqual(13);
    expect(ellipsisIndex).toBeLessThanOrEqual(16);
  });
});
