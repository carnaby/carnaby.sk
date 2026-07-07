import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { redirect } from '../../../i18n/navigation';
import { getServerSession } from '../../../lib/session';
import { GoogleSignInButton } from './google-sign-in-button';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'login' });
  return {
    title: `${t('title')} — carnaby.sk`,
    robots: { index: false, follow: false },
  };
}

/**
 * Public, locale-aware sign-in page. Google is the only provider (matching the
 * API's better-auth config); an already-signed-in visitor has nothing to do
 * here and is bounced to the locale homepage. Always dynamic — the session
 * check reads request cookies.
 */
export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getServerSession();
  if (session) {
    redirect({ href: '/', locale });
  }

  const t = await getTranslations({ locale, namespace: 'login' });

  return (
    <div className="flex min-h-[60dvh] items-center justify-center px-4 py-16">
      <div className="glass w-full max-w-sm rounded-glass p-8 text-center">
        <h1 className="font-display text-2xl font-semibold text-white">{t('title')}</h1>
        <p className="mt-2 text-sm text-white/60">{t('subtitle')}</p>
        <GoogleSignInButton label={t('googleCta')} />
      </div>
    </div>
  );
}
