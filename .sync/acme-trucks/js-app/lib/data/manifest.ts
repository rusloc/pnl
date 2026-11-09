import { z } from 'zod';
import type { ColumnSpec } from './parquet-columns.ts';

// Data contract of public/data (docs/ADD/features/trucks-js-flavour.md §2.3, §2.5; schema 'acme-trucks/1'). English names
// are the TMDL column names of Trucks.SemanticModel; the only Cyrillic that ships is the data values used as codes
// (category_code, the is_included literal). FILES is the one place the build and the loader share the Parquet column
// specs; the engine never names a Parquet column outside it.

/** The 19 sort orders a bridge can produce; one Parquet column each (§2.3). 13, 16, 17 fold into 21; 26 into 25 / 27. */
export const TIME_SORTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 21, 22, 24, 25, 27] as const;
export type TimeSort = (typeof TIME_SORTS)[number];

type SortTag =
  | '01'
  | '02'
  | '03'
  | '04'
  | '05'
  | '06'
  | '07'
  | '08'
  | '09'
  | '10'
  | '11'
  | '12'
  | '14'
  | '15'
  | '21'
  | '22'
  | '24'
  | '25'
  | '27';
export type SecColumn = `sec_${SortTag}`;
export type HrsColumn = `hrs_${SortTag}`;

const pad = (s: number) => String(s).padStart(2, '0');
export const secColumn = (s: TimeSort) => `sec_${pad(s)}` as SecColumn; // SortTag lists exactly TIME_SORTS
export const hrsColumn = (s: TimeSort) => `hrs_${pad(s)}` as HrsColumn;

const timeColumns = <C extends string>(column: (s: TimeSort) => C) =>
  Object.fromEntries(TIME_SORTS.map((s) => [column(s), 'num?'])) as Record<C, 'num?'>;

const KEYS = { loader_ix: 'int', week_ix: 'int', n_rows: 'int' } as const;

export const FILES = {
  /** loader × business week: Σ duration (seconds) per time category; null = the loader-week has no row of that category. */
  timeWeek: { file: 'time-week.parquet', lazy: false, columns: { ...KEYS, ...timeColumns(secColumn) } },
  /** loader × business week: Σ indicator_amount of the month plan (stored daily), as stored. */
  planMonth: { file: 'plan-month.parquet', lazy: false, columns: { ...KEYS, ...timeColumns(hrsColumn) } },
  /** loader × business week: Σ indicator_amount of the week plan; loaded on the first pick of Plan type = Week. */
  planWeek: { file: 'plan-week.parquet', lazy: true, columns: { ...KEYS, ...timeColumns(hrsColumn) } },
  /** loader × business week: the three rock-mass columns the page reads. */
  rockWeek: {
    file: 'rock-week.parquet',
    lazy: false,
    columns: {
      ...KEYS,
      rock_mass_truck_plan: 'num?',
      rock_mass_truck_fact: 'num?',
      rock_mass_truck_plan_month: 'num?',
    },
  },
} as const satisfies Record<string, { file: string; lazy: boolean; columns: ColumnSpec }>;

export type FileKey = keyof typeof FILES;
export const FIRST_PAINT_FILES = ['timeWeek', 'planMonth', 'rockWeek'] as const satisfies readonly FileKey[];
export const WORK_TYPES = ['On spot', 'Trucks', 'Undefined'] as const;
export type WorkType = (typeof WORK_TYPES)[number];

const int = z.number().int();
const isoDate = z.iso.date();

const week = z
  .object({
    week_ix: int.min(0),
    week_label: z.string().min(1),
    sort_span: int,
    week_num: int.min(1).max(53),
    week_start: isoDate,
    week_end: isoDate,
    year: int,
    days: int.min(1).max(7),
  })
  .strict();

const category = z
  .object({
    sort_order: int.min(1),
    category_code: z.string().min(1),
    category_name: z.string().min(1),
    is_shown: z.enum(['1', '0']),
    is_included: z.enum(['да', 'нет']),
    row_kind: z.enum(['subtotal', 'loss']),
  })
  .strict();

const fileEntry = z.object({ name: z.string().min(1), rows: int.min(0), bytes: int.positive() }).strict();

const loader = z
  .object({
    loader_ix: int.min(0),
    loader_name: z.string().min(1),
    office_name: z.string().min(1),
    bucket_volume_m3: int.min(0),
    work_type: z.enum(WORK_TYPES).nullable(),
  })
  .strict();

const meta = z
  .object({
    extract_date: isoDate,
    calendar_first: isoDate,
    calendar_last: isoDate,
    fact_first: isoDate,
    fact_last: isoDate,
    month_plan_first: isoDate,
    culture: z.literal('ru-RU'),
  })
  .strict();

const base = z
  .object({
    schema: z.literal('acme-trucks/1'),
    meta,
    weeks: z.array(week).length(23),
    loaders: z.array(loader).length(131),
    categories: z.array(category).length(31),
    offices: z.array(z.object({ office_name: z.string().min(1), sort_order: int.min(0) }).strict()).length(6),
    work_types: z.array(z.enum(WORK_TYPES)).length(3),
    files: z.object({ timeWeek: fileEntry, planMonth: fileEntry, planWeek: fileEntry, rockWeek: fileEntry }).strict(),
  })
  .strict();

export const manifestSchema = base;
export type Manifest = z.infer<typeof manifestSchema>;

// The fixture set of `--keep-excluded` (§2.2 last paragraph, tests only): the same files with every dim_loader row, the
// two fixed filters as flags, and one pseudo-loader for fact rows whose loader is missing from dim_loader (the model's
// blank member: no bucket volume, so it reaches only the plain sums, not the weighted means).
export const unfilteredManifestSchema = base
  .extend({
    schema: z.literal('acme-trucks-unfiltered/1'),
    meta: meta.extend({ fact_duration_sec_all: z.number().positive() }).strict(),
    loaders: z.array(
      loader
        .extend({
          bucket_volume_m3: int.min(0).nullable(),
          is_included: z.boolean(),
          contractor_blank: z.boolean(),
          is_blank_member: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict();
export type UnfilteredManifest = z.infer<typeof unfilteredManifestSchema>;
