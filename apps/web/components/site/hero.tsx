'use client';

import { Code2, Mail, Music2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';

/** Homepage hero: v1-style rounded banner image with an overlapping profile photo, name, role
 * badges, and a mailto contact button (ported from `views/index.ejs`'s `.profile-header`).
 * Client component for the `motion` fade/slide-in entrance — skipped when the user prefers
 * reduced motion. Images are plain `<img>` (static /public assets, no next/image benefit here). */
export function Hero() {
  const t = useTranslations('home');
  const nav = useTranslations('nav');
  const reduceMotion = useReducedMotion();

  return (
    <section className="mx-auto max-w-5xl px-4 pt-8 sm:pt-10">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="overflow-hidden rounded-2xl shadow-[0_50px_140px_-40px_rgb(168_85_247/0.35)] ring-1 ring-white/10"
      >
        <img
          src="/images/baner.webp"
          alt=""
          fetchPriority="high"
          className="h-44 w-full object-cover sm:h-60 md:h-72"
        />
      </motion.div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
        className="relative z-10 -mt-10 flex flex-col gap-5 px-2 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between sm:px-3"
      >
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:gap-5">
          <img
            src="/images/photo.webp"
            alt={t('name')}
            className="size-24 shrink-0 rounded-xl object-cover ring-4 ring-base sm:size-28"
          />
          <div className="pb-1">
            <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {t('name')} <span className="font-normal text-white/50">/ {t('nickname')}</span>
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-devlog/40 bg-devlog/10 px-3 py-1 text-xs font-medium text-devlog sm:text-sm">
                <Code2 size={14} aria-hidden="true" />
                {t('badgeDev')}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-dodo/40 bg-dodo/10 px-3 py-1 text-xs font-medium text-dodo sm:text-sm">
                <Music2 size={14} aria-hidden="true" />
                {t('badgeMusic')}
              </span>
              <span className="text-xs text-white/50 sm:text-sm">{t('location')}</span>
            </div>
          </div>
        </div>

        <a
          href="mailto:dodusik@gmail.com"
          className="inline-flex items-center gap-2 self-start rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#030303] transition-colors hover:bg-white/90 sm:self-end"
        >
          <Mail size={16} aria-hidden="true" />
          {nav('contact')}
        </a>
      </motion.div>
    </section>
  );
}
