import { useShortcutHint } from '../../hooks/useShortcutHint';

interface ShortcutHintProps {
  id: string;
  label: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function ShortcutHint({ id, label, position = 'bottom' }: ShortcutHintProps) {
  const visible = useShortcutHint(id);

  if (!visible) return null;

  const positionClasses: Record<string, string> = {
    top: 'bottom-full mb-1',
    bottom: 'top-full mt-1',
    left: 'right-full mr-1',
    right: 'left-full ml-1',
  };

  return (
    <span
      className={`absolute ${positionClasses[position]} z-50 px-2 py-0.5 rounded glass
        font-mono text-[10px] text-black-300 opacity-60 animate-fade-in whitespace-nowrap
        pointer-events-none`}
    >
      {label}
    </span>
  );
}
