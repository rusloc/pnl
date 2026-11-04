"use client";

import { useCallback, useState } from "react";

/**
 * The query-string state of a JS report shown in the site's report popup.
 *
 * Each report was written as a standalone app whose URL is its whole state (F-37 shareable links): it reads
 * `useSearchParams` and rewrites the address bar on every change. Inside the popup that state lives here instead,
 * in React, encoded with the same codec: the page URL stays what the visitor arrived with (a campaign link keeps
 * its `utm_` keys), and only "Copy link" hands out the page URL plus the report's state. Opening such a link
 * opens the popup in that state (`openOnQuery` on <ReportDialog>).
 *
 * Browser-only by construction: the reports mount after a click or a shared link, never on the server.
 */
export function useReportSearch() {
  const [search, setSearch] = useState(() => window.location.search.slice(1));
  const go = useCallback((query: string) => setSearch(query), []);
  // The page's own URL without its query: the state is appended by the caller.
  const pageUrl = `${window.location.origin}${window.location.pathname}`;
  return { search, go, shareUrl: search ? `${pageUrl}?${search}` : pageUrl };
}
