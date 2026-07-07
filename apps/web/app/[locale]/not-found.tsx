import { getTranslations } from 'next-intl/server';

import { Link } from '../../i18n/navigation';

/** Renders for any unmatched path under a valid locale (unknown post slug, mistyped category,
 * ...). `getTranslations` resolves via next-intl's request config the same way any page does --
 * the middleware sets the locale before this ever renders (see `middleware.ts`). */
export default async function NotFound() {
  const t = await getTranslations('notFound');

  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-display text-3xl font-bold text-white">{t('title')}</h1>
      <p className="mt-4 text-white/70">{t('description')}</p>
      <Link
        href="/"
        className="glass mt-8 inline-flex rounded-glass px-5 py-2.5 text-sm font-medium text-white/80 transition-colors hover:text-white"
      >
        {t('backHome')}
      </Link>
    </div>
  );
}
