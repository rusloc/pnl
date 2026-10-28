import type { Metadata } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Sans_Condensed } from 'next/font/google';
import './globals.css';

// Design guide §3: IBM Plex Sans (UI) and IBM Plex Sans Condensed (statement table), self-hosted by next/font at build
// time, so the CSP keeps font-src 'self'.
const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-plex',
});
const plexCondensed = IBM_Plex_Sans_Condensed({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-plex-condensed',
});

export const metadata: Metadata = {
  title: 'ACME Unified P&L',
  description: 'One management P&L for ACME Consumer Products, ACME Commerce Cloud and ACME Group.',
  ...(process.env.NEXT_PUBLIC_SITE_URL ? { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL) } : {}),
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${plex.variable} ${plexCondensed.variable}`}>
      <body>{children}</body>
    </html>
  );
}
