import { cn } from '../../lib/cn';

/** Title row shared by every admin screen; `actions` wrap under the title on narrow screens. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-5 flex flex-wrap items-end justify-between gap-3 lg:mb-8', className)}>
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-white lg:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-white/55">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
