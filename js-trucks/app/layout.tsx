import type { Metadata } from 'next';
import { Inter, Manrope } from 'next/font/google';
import { DOCUMENT_TITLE } from '@/lib/engine/copy';
import './globals.css';

// Root of the standalone ACME Trucks app (ADR-0016 (d); toolchain of js-marketing). Manrope (display numbers) and Inter
// (UI) are self-hosted by next/font at build time (contract §5.1), so the CSP keeps font-src 'self'.
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-inter' });
const manrope = Manrope({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-manrope' });

export const metadata: Metadata = {
  title: DOCUMENT_TITLE,
  description: 'How the haul trucks’ total time splits into work and time losses, plan against fact.',
  ...(process.env.NEXT_PUBLIC_SITE_URL ? { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL) } : {}),
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
