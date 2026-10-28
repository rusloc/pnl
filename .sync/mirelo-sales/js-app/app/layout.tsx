import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

// Root of the standalone Mirelo app (design-tokens §3): Inter, self-hosted by next/font at build time so the CSP keeps
// font-src 'self'. The variable is consumed by components/sales/sales.module.css. The route stays at /sales so the
// /data/sales/ paths and the URL contract are the same as in rusloc/pnl (js-report/app/sales/).
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Mirelo - Sales & revenue',
  description: 'Draft sales & revenue dashboard for Mirelo, a fictional neobank and microlender (PL, RO, PT).',
  ...(process.env.NEXT_PUBLIC_SITE_URL ? { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL) } : {}),
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
