import type { CoreFiles, FileRows } from '../data/loader.ts';
import { TIME_SORTS, hrsColumn, secColumn } from '../data/manifest.ts';
import type { Manifest, TimeSort, WorkType } from '../data/manifest.ts';

// The Dataset (contract §3): typed arrays per file, behind which the Parquet format hides. A null cell is NaN here (a
// loader-week with no row of that category, §2.3), so the engine's sums stay allocation-free; lib/engine converts NaN
// back to null at its public surface. The loader-week grain also serves the fixture set (fixtures/data-unfiltered).

export interface TimeTable {
  id: 'fact' | 'planMonth' | 'planWeek';
  rows: number;
  loader: Int32Array;
  week: Int32Array;
  nRows: Int32Array;
  /** One column per TIME_SORTS entry, NaN = null. */
  cols: Float64Array[];
}

export interface RockTable {
  rows: number;
  loader: Int32Array;
  week: Int32Array;
  plan: Float64Array;
  fact: Float64Array;
  planMonth: Float64Array;
}

/** What the engine reads of a manifest: the shipped one, or the fixture set's (nullable bucket volume). */
export interface DatasetManifest {
  weeks: Manifest['weeks'];
  categories: Manifest['categories'];
  offices: Manifest['offices'];
  loaders: {
    loader_name: string;
    office_name: string;
    bucket_volume_m3: number | null;
    work_type: WorkType | null;
  }[];
}

export interface Dataset {
  m: DatasetManifest;
  nLoaders: number;
  /** Bucket volume per loader, NaN = blank (the fixture set's blank member only). */
  vol: Float64Array;
  time: TimeTable;
  planMonth: TimeTable;
  planWeek: TimeTable | null;
  rock: RockTable;
  /** Memoised window sums (hours.ts): one entry per table × window. */
  windows: Map<string, unknown>;
}

const toNaN = (v: number | null): number => (v === null ? Number.NaN : v);

function timeTable(
  id: TimeTable['id'],
  rows: readonly ({ loader_ix: number; week_ix: number; n_rows: number } & Record<string, unknown>)[],
  column: (s: TimeSort) => string,
): TimeTable {
  const cols = TIME_SORTS.map((s) => {
    const name = column(s);
    return Float64Array.from(rows, (r) => toNaN(r[name] as number | null)); // readRows checked every cell against 'num?'
  });
  return {
    id,
    rows: rows.length,
    loader: Int32Array.from(rows, (r) => r.loader_ix),
    week: Int32Array.from(rows, (r) => r.week_ix),
    nRows: Int32Array.from(rows, (r) => r.n_rows),
    cols,
  };
}

export function createDataset<M extends DatasetManifest>(core: CoreFiles<M>): Dataset {
  const { manifest, timeWeek, planMonth, rockWeek } = core;
  return {
    m: manifest,
    nLoaders: manifest.loaders.length,
    vol: Float64Array.from(manifest.loaders, (l) => toNaN(l.bucket_volume_m3)),
    time: timeTable('fact', timeWeek, secColumn),
    planMonth: timeTable('planMonth', planMonth, hrsColumn),
    planWeek: null,
    rock: {
      rows: rockWeek.length,
      loader: Int32Array.from(rockWeek, (r) => r.loader_ix),
      week: Int32Array.from(rockWeek, (r) => r.week_ix),
      plan: Float64Array.from(rockWeek, (r) => toNaN(r.rock_mass_truck_plan)),
      fact: Float64Array.from(rockWeek, (r) => toNaN(r.rock_mass_truck_fact)),
      planMonth: Float64Array.from(rockWeek, (r) => toNaN(r.rock_mass_truck_plan_month)),
    },
    windows: new Map(),
  };
}

export function addPlanWeek(ds: Dataset, rows: FileRows<'planWeek'>): void {
  ds.planWeek = timeTable('planWeek', rows, hrsColumn);
}
