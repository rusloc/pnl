import type { Metadata } from 'next';
import { Inter, Manrope } from 'next/font/google';
import { BRAND } from '@/lib/engine/copy';
import './globals.css';

// Root of the standalone ACME Marketing app (ADR-0015; toolchain of js-exec, ADR-0013 (h)). Manrope (display numbers)
// and Inter (text) are self-hosted by next/font at build time (contract §5.1), so the CSP keeps font-src 'self';
// globals.css reads them through --font-manrope / --font-inter.
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-inter' });
const manrope = Manrope({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-manrope' });

export const metadata: Metadata = {
  title: BRAND.alt,
  description: `${BRAND.alt} for ACME, a fictional SaaS analytics product: paid acquisition on web, iOS and Android. Illustrative data.`,
  ...(process.env.NEXT_PUBLIC_SITE_URL ? { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL) } : {}),
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
