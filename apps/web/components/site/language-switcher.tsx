'use client';

import { useLocale, useTranslations } from 'next-intl';

import { LANGUAGES, type Language } from '@carnaby/shared';

import { usePathname, useRouter } from '../../i18n/navigation';

const SWITCH_LABEL_KEY: Record<Language, 'switchToSk' | 'switchToEn'> = {
  sk: 'switchToSk',
  en: 'switchToEn',
};

// Same two-button toggle as before (functionality and aria-labels are e2e-relied-on, see
// apps/web-e2e/src/home.spec.ts) — just tightened up to read as a compact "EN ▾"-style dropdown
// pill (v1's `.lang-dropdown`) rather than two equal-weight buttons.
export function LanguageSwitcher() {
  const locale = useLocale() as Language;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('languageSwitcher');

  return (
    <div className="glass flex items-center gap-0.5 rounded-full p-1" role="group" aria-label={t('label')}>
      {LANGUAGES.map((lng) => {
        const active = lng === locale;
        return (
          <button
            key={lng}
            type="button"
            aria-pressed={active}
            aria-label={t(SWITCH_LABEL_KEY[lng])}
            onClick={() => router.replace(pathname, { locale: lng })}
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors ${
              active ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80'
            }`}
          >
            {lng}
          </button>
        );
      })}
    </div>
  );
}
