import type { CSSProperties, HTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Category accent color (e.g. `#10b981`) — adds a soft glow shadow when set. */
  accent?: string;
}

export function GlassCard({ accent, className, style, ...props }: GlassCardProps) {
  const glowStyle: CSSProperties | undefined = accent
    ? { boxShadow: `0 0 40px -12px ${accent}33`, ...style }
    : style;

  return <div className={cn('glass rounded-glass p-6', className)} style={glowStyle} {...props} />;
}
