import { clsx } from 'clsx';

interface ScriptCoverProps {
  title: string;
  author?: string;
  /** Stable seed (project id) so each script keeps its cover tint. */
  seed?: string;
  analysisVersion?: string;
  className?: string;
}

const TINT_COUNT = 5;

function tintFromSeed(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash % TINT_COUNT;
}

/**
 * A physical screenplay cover: neutral stock, title block,
 * "Written by" author line, binding dots, and a rev footer. Pure presentation,
 * ported from the approved Compact Shelf reference (.script-cover).
 */
function revisionLabel(analysisVersion?: string): string {
  const match = analysisVersion?.match(/^v(\d+)(?:_(triage))?/i);
  if (!match) return 'Legacy analysis';
  return `Rev. V${match[1]}${match[2] ? ' triage' : ''}`;
}

export function ScriptCover({
  title,
  author,
  seed,
  analysisVersion,
  className,
}: ScriptCoverProps) {
  return (
    <div
      aria-hidden="true"
      data-tint={seed ? tintFromSeed(seed) : 0}
      className={clsx('dsc-cover dsc-cover--container w-full', className)}
    >
      <span className="dsc-cover-art" />
      <span className="dsc-cover-rule" />
      <p className="dsc-cover-title">{title}</p>
      <p className="dsc-cover-author">
        Written by
        <br />
        {author || 'Unknown writer'}
      </p>
      <span className="dsc-cover-foot">
        Lemon Studios · {revisionLabel(analysisVersion)}
      </span>
    </div>
  );
}
