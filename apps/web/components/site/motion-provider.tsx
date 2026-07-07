'use client';

import { MotionConfig } from 'motion/react';

export interface MotionProviderProps {
  children: React.ReactNode;
}

/** Wraps child components with Framer Motion's MotionConfig to respect the OS
 * `prefers-reduced-motion` setting globally. This ensures all animations
 * (e.g., PostCard hover lift, PillarCard hover bloom) are disabled for users
 * who have enabled reduced motion in their OS settings. */
export function MotionProvider({ children }: MotionProviderProps) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
