import type { Metadata } from 'next';

import { SiteFooter } from '../components/site/footer';
import { SiteHeader } from '../components/site/header';
import { fontVars } from '../lib/fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'carnaby.sk',
  description: 'DevLog, Dodo, and Carnaby — code and music by Jozef Sokol.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk" className={fontVars}>
      <body className="site-bg min-h-dvh antialiased">
        <SiteHeader />
        <main className="pt-20">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
