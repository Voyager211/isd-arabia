import type { Metadata, Viewport } from 'next';
import { Barlow_Condensed, Inter } from 'next/font/google';
import { Toaster } from 'sonner';

import './globals.css';

import { t } from '@/lib/i18n/en';
import { siteUrl } from '@/lib/site-config';
import { getShellData } from '@/lib/api/shell-data';
import { CartProvider } from '@/context/cart-context';
import { CartDrawer } from '@/components/client/cart-drawer';
import { SiteHeader } from '@/components/server/site-header';
import { SiteFooter } from '@/components/server/site-footer';

/**
 * Self-hosted via next/font, so there is no render-blocking request to
 * fonts.googleapis.com and no layout shift when the face swaps in
 * (PROJECT_PLAN.md §5.2).
 */
const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-barlow-condensed',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${t.brand.name} — ${t.brand.tagline}`,
    template: `%s | ${t.brand.name}`,
  },
  description:
    'Industrial supplies distribution across Saudi Arabia — welding consumables, safety equipment, scaffolding tools and MRO supply. Browse the catalogue and request a quotation.',
  openGraph: {
    type: 'website',
    siteName: t.brand.name,
    locale: 'en',
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0B2545',
  width: 'device-width',
  initialScale: 1,
};

/**
 * Root layout — a SERVER component, deliberately.
 *
 * `CartProvider` is a client component mounted here, but it does not make this
 * tree client-rendered: `children` are passed to it as a prop, already
 * server-rendered. Marking this file `'use client'` to make the cart context
 * work would convert the entire catalogue to client rendering and throw away
 * the reason we chose Next.js (CLAUDE.md §4).
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { menu, industries } = await getShellData();

  return (
    <html lang="en" dir="ltr" className={`${barlowCondensed.variable} ${inter.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <CartProvider>
          <a href="#main" className="skip-link">
            {t.common.skipToContent}
          </a>

          <SiteHeader menu={menu} />

          <main id="main" className="flex-1">
            {children}
          </main>

          <SiteFooter industries={industries} />

          <CartDrawer />
          {/* Sonner has no logical-property position; bottom-right is the LTR
              equivalent and would need flipping alongside dir="rtl". */}
          <Toaster position="bottom-right" richColors closeButton />
        </CartProvider>
      </body>
    </html>
  );
}
