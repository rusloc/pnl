import { beforeAll, describe, expect, it } from "vitest";
import { loadSalesBase, loadSalesDetail } from "./test-utils/sales-data";
import { createCube } from "./cube";
import type { Cube } from "./cube";
import { createSalesEngine } from "./index";
import type { SalesEngine } from "./index";
import { bridge } from "./loans";
import type {
  DetailParts,
  Drill,
  MarketSel,
  SalesSelection,
  TimeView,
  ViewId,
} from "./types";
import { monthIndex, windowOf } from "./windows";

// View models end to end (default window + a sweep), the originations bridge, and the full detail files (2026-11-01)
// reconciled to the aggregates.

let engine: SalesEngine;
let cube: Cube;
// `tv` builds the period the old way (Month / QTD / YTD / R12M on the anchor, clamped to the data start): the period
// is a range `from`…`anchor` since 2026-11-01, and these windows are the ones the window stats cover.
const sel = ({
  tv = "M",
  ...patch
}: Partial<SalesSelection> & { tv?: TimeView } = {}): SalesSelection => {
  const anchor = patch.anchor ?? monthIndex("2026-09");
  return {
    view: "overview",
    market: "ALL",
    from: Math.max(0, windowOf(tv, anchor).start),
    anchor,
    cmp: "BUD",
    drill: null,
    ...patch,
  };
};

beforeAll(async () => {
  const base = await loadSalesBase();
  engine = createSalesEngine(base);
  cube = createCube(base);
});

describe("Overview (default window: Month · Sep 2026 · All markets · vs Budget)", () => {
  it("hero values match the README headline row for Sep 2026", () => {
    const vm = engine.overview(sel());
    expect(vm.heroes.map((h) => [h.label, h.value, h.second])).toEqual([
      ["Loans issued", "24.4k", "€9.6m"],
      ["New clients locked in", "9,796", null],
      ["Returning clients", "59.9%", null],
      ["Bad / overdue loans", "4.6%", null],
    ]);
    expect(vm.heroes[2]?.rows[0].text).toBe("n/a"); // returning % has no Budget
    expect(vm.heroes.every((h) => !("spark" in h))).toBe(true); // design-requirements §1: no in-card sparklines
    expect(vm.charts.map((c) => c.id)).toEqual(["o5", "o6", "o7", "o8"]);
    expect(vm.table.rows.map((r) => r.cells[0]?.text)).toEqual([
      "Poland",
      "Romania",
      "Portugal",
    ]);
  });

  it("Romania runs behind Budget and Portugal ahead in FY2026 YTD (README story)", () => {
    const vm = engine.overview(sel({ tv: "Y" }));
    const status = Object.fromEntries(
      vm.table.rows.map((r) => [r.key, r.cells[2]?.status]),
    );
    expect(status).toMatchObject({ RO: "off", PT: "good" });
  });

  it("builds the header period line from the selection", () => {
    expect(
      engine.header(sel({ market: "RO", tv: "Q", cmp: "PY" })).periodLine,
    ).toBe(
      "Showing Jul–Sep 2026 - Quarter - Romania - Actual vs Prior year and Budget - Closed through Sep 2026",
    );
    expect(
      engine.header(sel({ tv: "R", anchor: monthIndex("2024-06") })).periodLine,
    ).toContain("Showing Jan–Jun 2024 - Custom range"); // the window starts at the data start, never before it
  });
});

describe("ADR-0012: card face = title · value · delta rows · status chip; the rest behind ⓘ / How to read", () => {
  const views: ViewId[] = [
    "overview",
    "loans",
    "clients",
    "portfolio",
    "revenue",
  ];
  it.each(views)(
    "%s: every card and panel carries a complete ⓘ, no sub-line or footnote on the face",
    (view) => {
      const s = sel({ view });
      const vm = view === "overview" ? engine.overview(s) : engine.band(s);
      const cards =
        "heroes" in vm
          ? [...vm.heroes, ...vm.charts, vm.table]
          : [...vm.kpis, ...vm.charts, vm.table];
      for (const c of cards) {
        expect(c, c.id).not.toHaveProperty("sub");
        expect(c, c.id).not.toHaveProperty("note");
        for (const k of ["what", "why", "formula"] as const)
          expect(c.info[k].length, `${c.id}.${k}`).toBeGreaterThan(8);
      }
      const band = "heroes" in vm ? vm.heroes : vm.kpis;
      expect(band.some((c) => c.info.values.length > 0)).toBe(true); // the former sub-lines live in the pop-up
    },
  );

  it("one How to read per view, opening with the Showing sentence", () => {
    for (const view of views) {
      const h = engine.header(
        sel({ view, tv: "R", anchor: monthIndex("2024-06") }),
      ).howToRead;
      expect(h.title).toMatch(/^How to read - /);
      expect(h.lines[0]?.value).toMatch(/^Showing Jan–Jun 2024 - /); // the Showing sentence opens it
    }
    expect(
      new Set(views.map((view) => engine.header(sel({ view })).howToRead.title))
        .size,
    ).toBe(5);
  });

  it("hero chips follow the header comparator and fall back when it has no value", () => {
    const vm = engine.overview(sel());
    expect(vm.heroes[0]?.status?.text).toMatch(/^[▲▼◦] (Good|Watch|Off)$/);
    expect(vm.heroes[2]?.status).toEqual(
      vm.heroes[2]
        ? { text: expect.any(String), status: vm.heroes[2].rows[1].status }
        : null,
    ); // returning % has no Budget → PY
  });
});

describe("every view renders for every market × time view × comparator", () => {
  const views: ViewId[] = [
    "overview",
    "loans",
    "clients",
    "portfolio",
    "revenue",
  ];
  const markets: MarketSel[] = ["ALL", "PL", "RO", "PT"];
  const tvs: TimeView[] = ["M", "Q", "Y", "R"];
  it.each(views)("%s", (view) => {
    for (const market of markets)
      for (const tv of tvs)
        for (const anchor of [
          monthIndex("2024-01"),
          monthIndex("2025-06"),
          monthIndex("2026-09"),
        ]) {
          const s = sel({
            view,
            market,
            tv,
            anchor,
            cmp: anchor % 2 ? "PY" : "BUD",
          });
          const vm = view === "overview" ? engine.overview(s) : engine.band(s);
          const text = JSON.stringify(vm);
          expect(text, `${view} ${market} ${tv} ${anchor}`).not.toMatch(
            /NaN|Infinity|undefined/,
          );
          if (view !== "overview")
            expect((vm as ReturnType<SalesEngine["band"]>).kpis).toHaveLength(
              6,
            );
        }
  });
});

describe("originations bridge", () => {
  it("steps add up from Budget to Actual for every market and time view", () => {
    for (const mk of ["ALL", "PL", "RO", "PT"] as MarketSel[])
      for (const tv of ["M", "Q", "Y", "R"] as TimeView[]) {
        const b = bridge(cube, windowOf(tv, monthIndex("2026-09")), mk);
        expect(b, `${mk} ${tv}`).not.toBeNull();
        expect(Math.abs(b?.residual ?? 1), `${mk} ${tv}`).toBeLessThan(1e-4);
      }
    // README: Poland beats Budget in constant currency but misses in EUR, so its FX step is negative in FY2026 YTD.
    expect(
      bridge(cube, windowOf("Y", monthIndex("2026-09")), "PL")?.fx,
    ).toBeLessThan(0);
  });
});

/** The detail window of a drill, after loading the files it names (as the app does). */
async function drillVM(drill: Drill, at: SalesSelection = sel()) {
  const parts: DetailParts = await loadSalesDetail(
    engine.detailFiles(at, drill),
  );
  return engine.slideOver(at, parts, drill);
}
const list = async (drill: Drill, at?: SalesSelection) => {
  const vm = await drillVM(drill, at);
  if (vm.kind === "missing") throw new Error(`${vm.title}: ${vm.sub}`);
  return vm;
};
const rowsOf = (vm: {
  total: number;
  rowAt: (i: number) => { cells: string[] };
}) => Array.from({ length: vm.total }, (_, i) => vm.rowAt(i));

describe("full detail (2026-11-01): every list is complete and reconciles to the aggregates", () => {
  it("names only the files a drill needs", () => {
    const q = sel({ tv: "Q" });
    expect(engine.detailFiles(q, { kind: "loans", market: "RO" })).toEqual([
      "loans-2026-07.parquet",
      "loans-2026-08.parquet",
      "loans-2026-09.parquet",
    ]);
    expect(
      engine.detailFiles(q, { kind: "clients", market: "ALL", channel: null }),
    ).toHaveLength(3);
    expect(
      engine.detailFiles(sel(), { kind: "client", client: 1234567 }),
    ).toEqual(["client-07.parquet", "client-dim-07.parquet"]); // 1234567 % 64 = 7
  });

  it("Show loans lists every loan of the window × market; the CSV holds them all", async () => {
    for (const [mk, tv] of [
      ["RO", "M"],
      ["ALL", "Q"],
    ] as [MarketSel, TimeView][]) {
      const at = sel({ tv });
      const vm = await list({ kind: "loans", market: mk }, at);
      const n = cube.loans(windowOf(tv, monthIndex("2026-09")), mk).loans;
      expect(vm.total, `${mk} ${tv}`).toBe(n);
      expect(vm.title.startsWith(`${n.toLocaleString("en-US")} loans`)).toBe(
        true,
      );
      if (tv === "M") expect(vm.csv().split("\n")).toHaveLength(n + 1);
    }
  });

  it("an agent's list matches its aggregate", async () => {
    const vm = await list({ kind: "agent", agent: "A001" }, sel({ tv: "Y" }));
    const w = windowOf("Y", monthIndex("2026-09"));
    expect(vm.total).toBe(cube.agents(w).get("A001")?.loans);
  });

  it("a channel's new clients = its first loans (C11), every one of them", async () => {
    for (const ch of ["APP", "PAID", "PARTNER", "AGENT"]) {
      const vm = await list({ kind: "clients", market: "ALL", channel: ch });
      const n = cube.loans(windowOf("M", monthIndex("2026-09")), "ALL", {
        repeat: false,
        channel: ch,
      }).first;
      expect(vm.total, ch).toBe(n);
    }
  });

  it("a product's overdue list = its 30+ DPD loans at the close (P13), worst first", async () => {
    const snap = cube.snapshotBy(monthIndex("2026-09"), "RO", (r) => r.product);
    const vm = await list({ kind: "overdue", market: "RO", product: "STEP6" });
    expect(vm.total).toBe(snap?.get("STEP6")?.dpd30Count);
    const dpd = rowsOf(vm).map((r) => Number(r.cells[7]));
    expect(
      dpd.every((d, k) => d >= 30 && (k === 0 || d <= (dpd[k - 1] ?? 0))),
    ).toBe(true);
  });

  it("a list row opens the client card with the client's whole history", async () => {
    const clients = await list({
      kind: "clients",
      market: "PL",
      channel: null,
    });
    const top = clients.rowAt(0);
    const card = await list({ kind: "client", client: top.client });
    expect(card.kind).toBe("client");
    expect(card.sub).toContain(`${top.cells[6]} loans to date`); // the list's "Loans to date"
    expect(card.total).toBeGreaterThan(0);
  });
});

describe("2026-11-01, third round: funnel scale, heatmaps, returning approval, subscriber flow", () => {
  const card = (view: ViewId, id: string) => {
    const vm = engine.band(sel({ view }));
    if ("heroes" in vm) throw new Error("band expected");
    const c = vm.charts.find((x) => x.id === id);
    if (!c) throw new Error(`no ${id}`);
    return c;
  };

  it("L8: Started fills the scale; the yellow line = did not reach the next stage; none on the last", () => {
    const ch = card("loans", "l8").chart;
    if (ch.kind !== "funnel") throw new Error("funnel expected");
    const v = ch.rows.map((r) => r.value);
    expect(Math.max(...v)).toBe(v[0]);
    ch.rows.forEach((r, k) =>
      expect(r.lost).toBe(k < v.length - 1 ? r.value - (v[k + 1] ?? 0) : null),
    );
    expect(ch.rows[0]?.sub).toMatch(/^\d+% of leads - /);
  });

  it("L10 and C9 are heatmaps; C9 runs oldest cohort first, blank where a cohort is too young", () => {
    const l10 = card("loans", "l10").chart;
    expect(l10.kind).toBe("heat");
    if (l10.kind !== "heat") return;
    expect(l10.cols).toEqual(["Poland", "Romania", "Portugal"]);
    expect(l10.rows[0]?.cells[0]?.text).toBe("3,571"); // Flex 30 × PL, Sep 2026
    const c9 = card("clients", "c9").chart;
    expect(c9.kind).toBe("heat");
    if (c9.kind !== "heat") return;
    expect(c9.rows.map((r) => r.label)).toEqual([
      "Q4 2025",
      "Q1 2026",
      "Q2 2026",
      "Q3 2026",
    ]);
    expect(c9.cols[0]).toBe("45 d"); // nobody repeats within 30 days: those columns are dropped
    expect(c9.cols.at(-1)).toBe("180 d");
    expect(c9.rows.at(-1)?.cells.at(-1)).toEqual({ text: "", level: null });
  });

  it("C5 is the returning-client approval rate", () => {
    const vm = engine.band(sel({ view: "clients" }));
    if ("heroes" in vm) return;
    const c5 = vm.kpis.find((k) => k.id === "c5");
    const f = cube.funnel(windowOf("M", monthIndex("2026-09")), "ALL", true);
    expect(c5?.label).toBe("Returning-client approval rate");
    expect(c5?.value).toBe(`${((f.approved / f.submitted) * 100).toFixed(1)}%`);
  });

  it("R11 plots new and churned paying subscribers (Feb 2026: churn above sign-ups)", () => {
    const ch = card("revenue", "r11").chart;
    if (ch.kind !== "line") throw new Error("line expected");
    const feb = ch.x.indexOf("Feb");
    expect(ch.series.map((s) => [s.name, s.values[feb]])).toEqual([
      ["New", 665],
      ["Churned", 754],
    ]);
  });
});

describe("2026-11-01: aggregate tables on Clients and Portfolio, their rows open full lists", () => {
  it("C11: one row per channel; new clients add up to the C1 card; rows open that channel's clients", () => {
    const vm = engine.band(sel({ view: "clients" }));
    if ("heroes" in vm) return;
    expect(vm.table.title).toBe(
      "Acquisition by channel - Sep 2026 - All markets",
    );
    expect(vm.table.rows.map((r) => r.cells[0]?.text)).toEqual([
      "App",
      "Paid",
      "Partner",
      "Agent",
    ]);
    const sum = vm.table.rows.reduce(
      (t, r) => t + Number(r.cells[1]?.text.replace(/,/g, "")),
      0,
    );
    expect(sum.toLocaleString("en-US")).toBe(vm.kpis[0]?.value);
    expect(vm.table.rows[2]?.action).toEqual({
      kind: "drill",
      drill: { kind: "clients", market: "ALL", channel: "PARTNER" },
    });
    expect(vm.table.action?.drill).toEqual({
      kind: "clients",
      market: "ALL",
      channel: null,
    });
  });

  it("P13: one row per microloan product; buckets add up to the outstanding minus current", () => {
    const vm = engine.band(sel({ view: "portfolio" }));
    if ("heroes" in vm) return;
    expect(vm.table.title).toBe("Overdue by product - Sep 2026 - All markets");
    expect(vm.table.rows.map((r) => r.key)).toEqual([
      "FLEX30",
      "FLEX90",
      "STEP6",
      "STEP12",
      "BIZ",
    ]);
    const snap = cube.snapshotBy(
      monthIndex("2026-09"),
      "ALL",
      (r) => r.product,
    );
    const s = snap?.get("STEP6");
    expect(s && s.b1_29 + s.b30_59 + s.b60_89 + s.b90p + s.current).toBeCloseTo(
      s?.outstanding ?? 0,
      0,
    );
  });

  it("the lists: one channel's clients, one product's overdue loans", async () => {
    const clients = await list({
      kind: "clients",
      market: "ALL",
      channel: "PARTNER",
    });
    expect(clients.kind).toBe("clients");
    expect(clients.title).toMatch(
      /^[\d,]+ new clients - Partner - All markets - Sep 2026$/,
    );
    expect(rowsOf(clients).every((r) => r.cells[5] === "Partner")).toBe(true);

    const overdue = await list({
      kind: "overdue",
      market: "RO",
      product: "STEP6",
    });
    expect(overdue.kind).toBe("loans");
    expect(overdue.title).toMatch(
      /^[\d,]+ loans 30\+ DPD - Step 6 - Romania - Sep 2026$/,
    );
    expect(rowsOf(overdue).every((r) => r.cells[2] === "Step 6")).toBe(true);
  });
});

describe("2026-11-01: heat scale over the whole grid, sortable leaderboard", () => {
  it("each heatmap's levels run 0 … 1 over all its cells, not per column", () => {
    for (const [view, id] of [
      ["loans", "l10"],
      ["clients", "c9"],
      ["portfolio", "p9"],
    ] as [ViewId, string][]) {
      const vm = engine.band(sel({ view }));
      if ("heroes" in vm) continue;
      const ch = vm.charts.find((c) => c.id === id)?.chart;
      if (ch?.kind !== "heat") throw new Error(`${id}: heat expected`);
      const levels = ch.rows
        .flatMap((r) => r.cells.map((c) => c.level))
        .filter((l): l is number => l !== null);
      expect(Math.min(...levels), id).toBe(0);
      expect(Math.max(...levels), id).toBe(1);
      // exactly one minimum and one maximum cell across the grid (a per-column scale would give one per column)
      expect(levels.filter((l) => l === 1).length, id).toBeLessThan(
        ch.cols.length,
      );
    }
  });

  it("the agent leaderboard is sortable and every cell carries a sort key", () => {
    const vm = engine.band(sel({ view: "loans" }));
    if ("heroes" in vm) return;
    expect(vm.table.sortable).toBe(true);
    for (const r of vm.table.rows)
      expect(r.cells.every((c) => c.sort !== undefined)).toBe(true);
  });
});
