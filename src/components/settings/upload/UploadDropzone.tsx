/**
 * Upload Dropzone
 * Drag-and-drop zone for PDF file selection
 */

import { useState, useRef } from 'react';
import { clsx } from 'clsx';

interface UploadDropzoneProps {
  onFilesSelected: (files: FileList | null) => void;
  presentation?: 'settings' | 'intake';
}

export function UploadDropzone({ onFilesSelected, presentation = 'settings' }: UploadDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    onFilesSelected(e.dataTransfer.files);
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
        aria-label="Choose screenplay PDFs"
        accept=".pdf"
        multiple
        onChange={(e) => onFilesSelected(e.target.files)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
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
            Drop screenplay PDFs here or choose files
          </p>
          <p className={clsx('mt-1 text-sm', presentation === 'intake' ? 'text-[var(--dsc-ink-3)]' : 'text-black-400')}>
            Supports multiple PDF screenplays, up to 50 MB each
          </p>
        </div>
      </div>
    </div>
  );
}
