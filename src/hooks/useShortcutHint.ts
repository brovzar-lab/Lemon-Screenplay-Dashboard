import { useEffect, useRef, useState } from 'react';

const SHOWN_KEY = 'lemon-hints-shown';

function getShownHints(): Set<string> {
  try {
    const raw = localStorage.getItem(SHOWN_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markShown(id: string) {
  const shown = getShownHints();
  shown.add(id);
  localStorage.setItem(SHOWN_KEY, JSON.stringify([...shown]));
}

export function useShortcutHint(id: string, delayMs: number = 2000): boolean {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (getShownHints().has(id)) return;

    const show = () => {
      timerRef.current = setTimeout(() => setVisible(true), delayMs);
    };

    const dismiss = () => {
      clearTimeout(timerRef.current);
      setVisible((prev) => {
        if (prev) markShown(id);
        return false;
      });
    };

    show();

    window.addEventListener('keydown', dismiss);
    window.addEventListener('mousedown', dismiss);

    return () => {
      clearTimeout(timerRef.current);
      window.removeEventListener('keydown', dismiss);
      window.removeEventListener('mousedown', dismiss);
    };
  }, [id, delayMs]);

  return visible;
}
