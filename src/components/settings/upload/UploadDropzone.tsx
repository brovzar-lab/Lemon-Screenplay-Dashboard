/**
 * Upload Dropzone
 * Drag-and-drop zone for PDF file selection
 */

import { useState, useRef } from 'react';
import { clsx } from 'clsx';

interface UploadDropzoneProps {
  onFilesSelected: (files: FileList | null) => void;
}

export function UploadDropzone({ onFilesSelected }: UploadDropzoneProps) {
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
        dragActive
          ? 'border-gold-400 bg-gold-500/10'
          : 'border-black-600 hover:border-gold-500/50'
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        multiple
        onChange={(e) => onFilesSelected(e.target.files)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div className="space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-gold-500/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-gold-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </div>
        <div>
          <p className="text-gold-200 font-medium">
            Drop PDF files here or click to browse
          </p>
          <p className="text-sm text-black-400 mt-1">
            Supports multiple PDF screenplays
          </p>
        </div>
      </div>
    </div>
  );
}
