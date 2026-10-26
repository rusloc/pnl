import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

// Mirelo route shell (ADR-0011 (c), design-tokens §3): Inter, self-hosted by next/font at build time so the CSP keeps
// font-src 'self'. The variable is consumed by components/sales/sales.module.css; the P&L's fonts stay on the root.
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Mirelo - Sales & revenue',
  description: 'Draft sales & revenue dashboard for Mirelo, a fictional neobank and microlender (PL, RO, PT).',
};

export default function SalesLayout({ children }: LayoutProps<'/sales'>) {
  return <div className={inter.variable}>{children}</div>;
}
