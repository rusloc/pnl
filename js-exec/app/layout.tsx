import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

// Root of the standalone Nordmark app (ADR-0013 (h)). Inter is self-hosted by next/font at build time (E-60), so the CSP
// keeps font-src 'self'; globals.css reads it through --font-inter.
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Nordmark executive dashboard',
  description:
    'Executive dashboard for Nordmark Retail, a fictional multi-category reseller (NL + BE): twelve trading metrics for retail Week 43 of FY2026. Illustrative data.',
  ...(process.env.NEXT_PUBLIC_SITE_URL ? { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL) } : {}),
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
