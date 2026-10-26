import { Suspense } from 'react';
import { SalesApp } from '@/components/sales/SalesApp';

// Static shell (same pattern as the P&L page): no data on the server. The client reads the query string and loads
// public/data/sales in the browser; the Suspense boundary lets the route prerender while SalesApp reads useSearchParams.
export default function SalesPage() {
  return (
    <Suspense
      fallback={
        <p style={{ margin: 0, padding: '140px 32px', background: '#F3F2EF', color: '#5C5C58' }}>
          Loading Mirelo sales…
        </p>
      }
    >
      <SalesApp />
    </Suspense>
  );
}
