import { cn } from '../../lib/cn';

/** Toggle pill used for filters and multi-choice fields; 36px tall on phones for touch. */
export function Chip({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors lg:h-8 lg:px-3',
        active ? 'border-white/80 bg-white text-black' : 'border-line bg-white/[0.03] text-white/70 hover:bg-white/[0.07] hover:text-white',
        className,
      )}
    >
      {children}
    </button>
  );
}
