import { useState, useEffect } from 'react';

/**
 * Returns the number of grid columns matching current Tailwind breakpoints.
 *
 * Breakpoint → columns:
 *   >= 1536 (2xl) → 4
 *   >= 1280 (xl)  → 3
 *   >= 640  (sm)  → 2
 *   < 640         → 1
 */
function getColumns(): number {
  if (typeof window === 'undefined') return 3;
  const w = window.innerWidth;
  if (w >= 1536) return 4;
  if (w >= 1280) return 3;
  if (w >= 640) return 2;
  return 1;
}

export function useColumnCount(): number {
  const [columns, setColumns] = useState(() => getColumns());

  useEffect(() => {
    function update() {
      setColumns(getColumns());
    }

    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return columns;
}
