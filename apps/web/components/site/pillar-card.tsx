'use client';

import { Guitar, Music2, Terminal } from 'lucide-react';
import { motion } from 'motion/react';

import type { CategoryMeta, Language } from '@carnaby/shared';

import { Link } from '../../i18n/navigation';
import { cn } from '../../lib/cn';

const ICONS = { terminal: Terminal, guitar: Guitar, 'music-2': Music2 } as const;

const TEXT_CLASS: Record<CategoryMeta['slug'], string> = {
  devlog: 'text-devlog',
  dodo: 'text-dodo',
  carnaby: 'text-carnaby',
};

export interface PillarCardProps {
  category: CategoryMeta;
  locale: Language;
}

/** One of the homepage's three category pillars: icon, localized name + description, linking to
 * that category's feed. Hovering lifts the card and blooms a glow in the category's own color. */
export function PillarCard({ category, locale }: PillarCardProps) {
  const Icon = ICONS[category.icon];

  return (
    <motion.div
      whileHover={{ y: -6, boxShadow: `0 28px 80px -24px ${category.color}99` }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className="glass h-full rounded-glass"
    >
      <Link href={`/category/${category.slug}`} className="flex h-full flex-col gap-4 p-7">
        <span
          className="inline-flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: `${category.color}1a`, color: category.color }}
        >
          <Icon size={24} aria-hidden="true" />
        </span>
        <h3 className={cn('font-display text-xl font-semibold', TEXT_CLASS[category.slug])}>
          {category.name[locale]}
        </h3>
        <p className="flex-1 text-sm leading-relaxed text-white/70">{category.description[locale]}</p>
      </Link>
    </motion.div>
  );
}
