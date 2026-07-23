import { clsx } from 'clsx';

interface ScriptCoverProps {
  title: string;
  author?: string;
  /** Stable seed (project id) so each script keeps its paper tint. */
  seed?: string;
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
 * A physical paper screenplay cover: tinted stock, typewriter title block,
 * "Written by" author line, brass brads, and a rev footer. Pure presentation —
 * ported from the approved Compact Shelf reference (.script-cover).
 */
export function ScriptCover({ title, author, seed, className }: ScriptCoverProps) {
  return (
    <div
      aria-hidden="true"
      data-tint={seed ? tintFromSeed(seed) : 0}
      className={clsx('dsc-cover dsc-cover--container w-full', className)}
    >
      <p className="dsc-cover-title">{title}</p>
      <p className="dsc-cover-author">
        Written by
        <br />
        {author || 'Unknown writer'}
      </p>
      <span className="dsc-cover-foot">Lemon Studios · Rev. V9</span>
    </div>
  );
}
