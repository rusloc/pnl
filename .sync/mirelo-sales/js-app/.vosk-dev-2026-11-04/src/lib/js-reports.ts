import { URL_KEYS as MIRELO_KEYS } from "./mirelo/url-state";
import { URL_KEYS as NORDMARK_KEYS } from "./nordmark/engine/url-state";
import { SELECTION_KEYS } from "./pnl/state/selection-schema";
import { VIEW_STATE_KEYS } from "./pnl/state/view-state";

/**
 * The reports built in this repo (`platform: "js"` showcases): each is a client component under
 * `components/<report>/` over a framework-free engine in `lib/<report>/`, loading its own static data from
 * `public/data/<report>/` and computing every number in the browser. They were handed over as standalone apps
 * (docs/<report>/) and are owned here since.
 */
export type JsReport = "pnl" | "mirelo" | "nordmark";

/**
 * The query-string keys each report's state is encoded with. A showcase-page URL carrying one of them is a
 * shared report link (F-37): the page opens the popup on arrival, in that state.
 */
export const REPORT_QUERY_KEYS: Record<JsReport, readonly string[]> = {
  pnl: [...SELECTION_KEYS, ...VIEW_STATE_KEYS],
  mirelo: MIRELO_KEYS,
  nordmark: NORDMARK_KEYS,
};
