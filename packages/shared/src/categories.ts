import type { Language } from './i18n';

export type CategorySlug = 'devlog' | 'dodo' | 'carnaby';

export interface CategoryMeta {
  slug: CategorySlug;
  color: string;
  icon: 'terminal' | 'guitar' | 'music-2';
  name: Record<Language, string>;
  description: Record<Language, string>;
}

// Names/descriptions ported verbatim from v1's `categoryMeta`
// (git show carnaby-sk-origin:config/view-helpers.js).
export const CATEGORIES: Record<CategorySlug, CategoryMeta> = {
  devlog: {
    slug: 'devlog',
    color: '#10b981',
    icon: 'terminal',
    name: { sk: 'DevLog', en: 'DevLog' },
    description: {
      sk: "Tech svet, kódovanie, experimenty s AI a 'making of' tohto webu.",
      en: "Tech world, coding, AI experiments, and the 'making of' this site.",
    },
  },
  dodo: {
    slug: 'dodo',
    color: '#f59e0b',
    icon: 'guitar',
    name: { sk: 'Dodo', en: 'Dodo' },
    description: {
      sk: 'Akustický folk, storyteller balady a južanský rock.',
      en: 'Acoustic folk, storyteller ballads, and southern rock.',
    },
  },
  carnaby: {
    slug: 'carnaby',
    color: '#a855f7',
    icon: 'music-2',
    name: { sk: 'Carnaby', en: 'Carnaby' },
    description: {
      sk: 'Retro synth-pop a bezstarostné euro-disco.',
      en: 'Retro synth-pop and carefree euro-disco.',
    },
  },
};
