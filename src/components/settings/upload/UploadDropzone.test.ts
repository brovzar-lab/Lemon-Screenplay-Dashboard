import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { UploadDropzone } from './UploadDropzone';

function fileEntry(file: File): FileSystemEntry {
  return {
    isFile: true,
    isDirectory: false,
    name: file.name,
    file: (resolve: FileCallback) => resolve(file),
  } as unknown as FileSystemFileEntry;
}

function directoryEntry(...entries: FileSystemEntry[]): FileSystemEntry {
  let readCount = 0;
  return {
    isFile: false,
    isDirectory: true,
    name: 'screenplays',
    createReader: () => ({
      readEntries: (resolve: FileSystemEntriesCallback) => {
        resolve(readCount++ === 0 ? entries : []);
      },
    }),
  } as unknown as FileSystemDirectoryEntry;
}

describe('UploadDropzone', () => {
  it('walks a dropped folder until the directory reader is exhausted', async () => {
    const first = new File(['one'], 'First.pdf', { type: 'application/pdf' });
    const second = new File(['two'], 'Second.pdf', { type: 'application/pdf' });
    const root = directoryEntry(fileEntry(first), directoryEntry(fileEntry(second)));
    const transfer = {
      items: [{ kind: 'file', webkitGetAsEntry: () => root }],
      files: [],
    } as unknown as DataTransfer;
    const onFilesSelected = vi.fn();
    render(createElement(UploadDropzone, { onFilesSelected, presentation: 'intake' }));

    fireEvent.drop(screen.getByText('Drop screenplay PDFs here or choose files'), {
      dataTransfer: transfer,
    });

    await waitFor(() => expect(onFilesSelected).toHaveBeenCalledWith([first, second]));
  });
});
