"use client";

import dynamic from "next/dynamic";
import type { JsReport } from "@/lib/js-reports";

/**
 * The split point for each JS report's client chunk (its engine, hyparquet and its UI), same reason as
 * <SalesDashboardLazy>: only the page that renders a report downloads it, and only when the popup opens. The
 * report's data files load after that, in the browser.
 */
const REPORTS: Record<JsReport, React.ComponentType> = {
  pnl: dynamic(() => import("./pnl/shell").then((m) => m.Shell)),
  mirelo: dynamic(() => import("./mirelo/sales-app").then((m) => m.SalesApp)),
  nordmark: dynamic(() => import("./nordmark/exec-app").then((m) => m.ExecApp)),
};

export function JsReportLazy({ report }: { report: JsReport }) {
  const Report = REPORTS[report];
  return <Report />;
}
