import type { Metadata } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { SiteFooter } from '../../components/site/footer';
import { SiteHeader } from '../../components/site/header';
import { routing } from '../../i18n/routing';
import { fontVars } from '../../lib/fonts';
import '../globals.css';

export const metadata: Metadata = {
  title: 'carnaby.sk',
  description: 'DevLog, Dodo, and Carnaby — code and music by Jozef Sokol.',
};

// Pre-render both locales at build time instead of resolving them on demand.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enables static rendering for this locale (next-intl app-router docs).
  setRequestLocale(locale);

  return (
    <html lang={locale} className={fontVars}>
      <body className="site-bg min-h-dvh antialiased">
        <NextIntlClientProvider>
          <SiteHeader />
          <main className="pt-20">{children}</main>
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
