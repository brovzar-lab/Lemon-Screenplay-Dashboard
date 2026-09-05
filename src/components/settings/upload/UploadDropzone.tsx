/**
 * Upload Dropzone
 * Drag-and-drop zone for PDF file selection
 */

import { useState, useRef } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import type { UploadPresentation } from '@/components/settings/upload/upload.types';

interface UploadDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  presentation?: UploadPresentation;
}

function readFileEntry(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

function readDirectoryBatch(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

async function readEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) return [await readFileEntry(entry as FileSystemFileEntry)];
  if (!entry.isDirectory) return [];

  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const entries: FileSystemEntry[] = [];
  for (;;) {
    const batch = await readDirectoryBatch(reader);
    if (batch.length === 0) break;
    entries.push(...batch);
  }
  return (await Promise.all(entries.map(readEntry))).flat();
}

async function collectDroppedFiles(dataTransfer: DataTransfer): Promise<File[]> {
  const entries = Array.from(dataTransfer.items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.webkitGetAsEntry());
  if (entries.length === 0 || entries.some((entry) => entry === null)) {
    return Array.from(dataTransfer.files);
  }
  return (await Promise.all(entries.map((entry) => readEntry(entry!)))).flat();
}

export function UploadDropzone({ onFilesSelected, presentation = 'settings' }: UploadDropzoneProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    try {
      onFilesSelected(await collectDroppedFiles(e.dataTransfer));
    } catch {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={clsx(
        'relative border-2 border-dashed rounded-xl p-12 text-center transition-all',
        presentation === 'intake'
          ? dragActive
            ? 'border-[var(--dsc-accent)] bg-[var(--dsc-accent-soft)]'
            : 'min-h-72 border-[var(--dsc-line)] bg-[var(--dsc-surface-2)] hover:border-[var(--dsc-accent)]'
          : dragActive
          ? 'border-gold-400 bg-gold-500/10'
          : 'border-black-600 hover:border-gold-500/50'
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        aria-label={t('Choose screenplay PDFs')}
        accept=".pdf"
        multiple
        onChange={(event) => {
          onFilesSelected(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
        className="hidden"
      />
      <input
        ref={(node) => {
          folderInputRef.current = node;
          node?.setAttribute('webkitdirectory', '');
        }}
        type="file"
        aria-label={t('Choose a screenplay folder')}
        accept=".pdf"
        multiple
        onChange={(event) => {
          onFilesSelected(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
        className="hidden"
      />
      <div className="space-y-4">
        <div className={clsx(
          'mx-auto flex h-16 w-16 items-center justify-center rounded-full',
          presentation === 'intake' ? 'bg-[var(--dsc-accent-soft)]' : 'bg-gold-500/20',
        )}>
          <svg className={clsx('h-8 w-8', presentation === 'intake' ? 'text-[var(--dsc-accent)]' : 'text-gold-400')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </div>
        <div>
          <p className={clsx('font-medium', presentation === 'intake' ? 'text-[var(--dsc-ink)]' : 'text-gold-200')}>
            {t('Drop screenplay PDFs here or choose files')}
          </p>
          <p className={clsx('mt-1 text-sm', presentation === 'intake' ? 'text-[var(--dsc-ink-3)]' : 'text-black-400')}>
            {t('Supports multiple PDF screenplays, up to 50 MB each')}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={presentation === 'intake' ? 'dsc-btn dsc-btn-primary' : 'btn btn-primary'}
            >
              {t('Choose PDF files')}
            </button>
            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              className={presentation === 'intake' ? 'dsc-btn' : 'btn btn-secondary'}
            >
              {t('Choose folder')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
