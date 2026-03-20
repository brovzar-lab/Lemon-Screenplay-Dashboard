import type { Screenplay } from '@/types/screenplay';

interface BulkReanalyzeModalProps {
  isOpen: boolean;
  onClose: () => void;
  screenplays: Screenplay[];
}

export function BulkReanalyzeModal({ isOpen }: BulkReanalyzeModalProps) {
  if (!isOpen) return null;
  return null;
}
