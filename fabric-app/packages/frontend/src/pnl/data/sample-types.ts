// Shapes of the mockup's `DATA` constant (see sample-data.ts). Kept separate so
// the generated file stays a pure data literal.

/** [code, parentCode, kind, label, alias, tags, cells(11), toneCodes(11), barFraction] */
export type SampleRow = [
  string,
  string,
  'sec' | 'grp' | 'leaf' | 'ent' | 'sub' | 'memo' | 'key' | 'ratio',
  string,
  string,
  string[],
  string[],
  string,
  number | null,
];

/** [name, text, tone] — tone 'f' favourable, 'u' unfavourable, '0' neutral */
export type SampleDelta = [string, string, 'f' | 'u' | '0'];

export interface SampleTile {
  l: string;
  v: string;
  h: string;
  s: SampleDelta[];
}

/** [label, valueText, kind, bottomPct, heightPct] */
export type SampleBridgeStep = [string, string, 't' | 'f' | 'u', number, number];

/** [name, block, baseText, compareText, deltaText, deltaPctText, tone] */
export type SampleDriver = [string, string, string, string, string, string, 'f' | 'u'];

/** [name, nrText, shareText, sharePct, deltaPctText, tone, gm, cm, ebitda, op] */
export type SampleProfRow = [
  string,
  string,
  string,
  number,
  string,
  'f' | 'u' | '0',
  string,
  string,
  string,
  string,
];

export interface SampleEntityData {
  rows: SampleRow[];
  kpis: SampleTile[];
  ops: SampleTile[];
  bridge: { vs: string; geo: SampleBridgeStep[]; axis: string };
  drivers: SampleDriver[];
  prof: SampleProfRow[];
}
