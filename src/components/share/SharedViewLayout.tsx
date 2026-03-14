/**
 * SharedViewLayout — Stub (will be fully implemented in Task 2)
 */
import type { SharedViewDocument } from '@/lib/shareService';

interface SharedViewLayoutProps {
  data: SharedViewDocument;
}

export function SharedViewLayout({ data }: SharedViewLayoutProps) {
  return (
    <div className="min-h-screen bg-black-900 text-white p-8">
      <h1>{data.analysis.title}</h1>
    </div>
  );
}
