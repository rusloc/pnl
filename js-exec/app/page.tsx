import { Suspense } from 'react';
import { ExecApp } from '@/components/ExecApp';

// Static shell: no data on the server (ADR-0002 §2.2). The client reads the query string and loads public/data in the
// browser; the Suspense boundary lets the route prerender while ExecApp reads useSearchParams (cacheComponents).
export default function Page() {
  return (
    <Suspense fallback={<p className="loading">Loading Nordmark…</p>}>
      <ExecApp />
    </Suspense>
  );
}
