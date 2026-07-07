import { useLocale } from 'next-intl';

import { CATEGORIES, type CategorySlug, type Language } from '@carnaby/shared';

import { Link } from '../../i18n/navigation';
import { LanguageSwitcher } from './language-switcher';
import { UserMenu } from './user-menu';

// Tailwind needs literal class names to detect them at build time, so the
// per-category hover classes are spelled out here rather than built from a
// template string off `category.slug`.
const NAV_HOVER_CLASS: Record<CategorySlug, string> = {
  devlog: 'hover:text-devlog',
  dodo: 'hover:text-dodo',
  carnaby: 'hover:text-carnaby',
};

const NAV_CATEGORIES = Object.values(CATEGORIES);

export function SiteHeader() {
  const locale = useLocale() as Language;

  return (
    <header className="fixed inset-x-0 top-0 z-50 glass-strong">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="font-display text-lg font-semibold tracking-tight text-white">
          carnaby.sk
        </Link>

        <nav className="flex items-center gap-6">
          {NAV_CATEGORIES.map((category) => (
            <Link
              key={category.slug}
              href={`/category/${category.slug}`}
              className={`text-sm font-medium text-white/80 transition-colors ${NAV_HOVER_CLASS[category.slug]}`}
            >
              {category.name[locale]}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
