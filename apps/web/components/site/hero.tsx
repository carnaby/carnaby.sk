'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';

/** Homepage hero: animated gradient headline + localized subtitle. Client component because it
 * uses `motion` for the fade/slide-in entrance and the gradient drift keyframe (see
 * `app/globals.css`'s `hero-gradient`) — both skipped when the user prefers reduced motion. */
export function Hero() {
  const t = useTranslations('home');
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative px-4 py-24 text-center sm:py-32">
      <motion.h1
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="mx-auto max-w-3xl bg-gradient-to-r from-devlog via-dodo to-carnaby bg-[length:200%_auto] bg-clip-text font-display text-4xl font-bold tracking-tight text-transparent sm:text-6xl"
        style={reduceMotion ? undefined : { animation: 'hero-gradient 8s ease-in-out infinite' }}
      >
        Jozef Sokol — Code &amp; Music
      </motion.h1>
      <motion.p
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
        className="mx-auto mt-6 max-w-xl text-balance text-lg text-white/70"
      >
        {t('heroSubtitle')}
      </motion.p>
    </section>
  );
}
