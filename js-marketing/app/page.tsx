import { MarketingApp } from '@/components/MarketingApp';

// Static shell: no data on the server (ADR-0002 §2.2). The client reads the URL (hash = view, query = state) and loads
// public/data in the browser; nothing here reads search params, so the route prerenders without a Suspense boundary.
export default function Page() {
  return <MarketingApp />;
}
