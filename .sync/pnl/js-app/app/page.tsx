import { Suspense } from 'react';
import { Shell } from '@/components/Shell';

// Static shell: the page holds no data. The client reads the query string (F-37) and loads public/data in the browser
// (ADR-0002 §2.1); the Suspense boundary is what lets the route prerender while Shell reads useSearchParams.
export default function Page() {
  return (
    <Suspense fallback={<p style={{ padding: 24, color: 'var(--slate-600)' }}>Loading the P&amp;L…</p>}>
      <Shell />
    </Suspense>
  );
}
