'use client';

import { Cpu, Guitar, Music2, PenTool, Sprout, Terminal } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';

import { CATEGORIES, type CategorySlug, type Language } from '@carnaby/shared';

import { Link } from '../../i18n/navigation';
import { cn } from '../../lib/cn';
import { GlassCard } from './glass';

const ICONS = { terminal: Terminal, guitar: Guitar, 'music-2': Music2 } as const;

const TEXT_CLASS: Record<CategorySlug, string> = {
  devlog: 'text-devlog',
  dodo: 'text-dodo',
  carnaby: 'text-carnaby',
};

const DOT_CLASS: Record<CategorySlug, string> = {
  devlog: 'bg-devlog',
  dodo: 'bg-dodo',
  carnaby: 'bg-carnaby',
};

const PILLARS = Object.values(CATEGORIES);

/** Homepage "About me" section: intro copy plus the three category pillars (long descriptions,
 * ported verbatim from v1's `config/view-helpers.js` via `messages/*.json`'s `home.pillars`),
 * all inside one glass panel — mirrors `views/index.ejs`'s `.about-section` while keeping the
 * black-glass visual language. `id="about"` is the header's "About" nav anchor target. Client
 * component for the mini-cards' `motion` hover lift. */
export function About() {
  const locale = useLocale() as Language;
  const t = useTranslations('home');

  return (
    <section id="about" className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
      <GlassCard className="p-6 sm:p-10">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-devlog">
          <Sprout size={16} aria-hidden="true" />
          {t('aboutLabel')}
        </div>

        <div className="mt-6 space-y-4 text-white/75">
          <p>{t('aboutIntro')}</p>
          <p>{t('aboutIntro2')}</p>
        </div>

        <div data-testid="pillars" className="mt-10 grid gap-6 sm:grid-cols-3">
          {PILLARS.map((category) => {
            const Icon = ICONS[category.icon];
            return (
              <motion.div
                key={category.slug}
                whileHover={{ y: -4 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                className="rounded-glass border border-line bg-white/[0.03]"
              >
                <Link href={`/category/${category.slug}`} className="flex h-full flex-col gap-3 p-5">
                  <span style={{ color: category.color }}>
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <h4
                    className={cn(
                      'flex items-center gap-2 font-display text-lg font-semibold',
                      TEXT_CLASS[category.slug],
                    )}
                  >
                    {category.name[locale]}
                    <span
                      aria-hidden="true"
                      className={cn('inline-block size-1.5 rounded-full', DOT_CLASS[category.slug])}
                    />
                  </h4>
                  <p className="text-sm leading-relaxed text-white/70">{t(`pillars.${category.slug}`)}</p>
                </Link>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-line pt-6 text-xs text-white/50 sm:flex-row sm:items-center sm:gap-6">
          <span className="inline-flex items-center gap-1.5">
            <Cpu size={14} className="text-devlog" aria-hidden="true" />
            {t('aiMusicNote')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <PenTool size={14} className="text-devlog" aria-hidden="true" />
            {t('humanLyricsNote')}
          </span>
        </div>
      </GlassCard>
    </section>
  );
}
