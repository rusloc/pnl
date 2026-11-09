import type { Dataset } from './data.ts';
import type { Selection } from './selection.ts';

// Masks and the cross-filtered lists (contract §3.1). The fixed filters are applied in the build. A pick that the other
// picks make empty stays picked (Power BI keeps the slicer state): the mask is then empty and the page shows R8.

type Pick = Pick_<Selection, 'offices' | 'loaders' | 'workTypes'>;
type Pick_<T, K extends keyof T> = { [P in K]: T[P] };

const passesWork = (ds: Dataset, ix: number, s: Pick) => {
  const w = ds.m.loaders[ix]?.work_type ?? null;
  return s.workTypes.length === 0 || (w !== null && s.workTypes.includes(w));
};
const passesOffice = (ds: Dataset, ix: number, s: Pick) =>
  s.offices.length === 0 || s.offices.includes(ds.m.loaders[ix]?.office_name ?? '');
const passesLoader = (ds: Dataset, ix: number, s: Pick) =>
  s.loaders.length === 0 || s.loaders.includes(ds.m.loaders[ix]?.loader_name ?? '');

/** The loader indices of the mask M: office ∩ loader ∩ work type. */
export function loaderMask(ds: Dataset, s: Pick): number[] {
  const out: number[] = [];
  for (let i = 0; i < ds.nLoaders; i++)
    if (passesOffice(ds, i, s) && passesLoader(ds, i, s) && passesWork(ds, i, s)) out.push(i);
  return out;
}

/** Offices of the loaders passing the loader + work-type picks, A–Z. */
export function officeList(ds: Dataset, s: Pick): string[] {
  const seen = new Set<string>();
  for (let i = 0; i < ds.nLoaders; i++)
    if (passesLoader(ds, i, s) && passesWork(ds, i, s)) seen.add(ds.m.loaders[i]?.office_name ?? '');
  return ds.m.offices.map((o) => o.office_name).filter((o) => seen.has(o));
}

/** Loaders passing the office + work-type picks, A–Z (manifest order). */
export function loaderList(ds: Dataset, s: Pick): string[] {
  const out: string[] = [];
  for (let i = 0; i < ds.nLoaders; i++)
    if (passesOffice(ds, i, s) && passesWork(ds, i, s)) out.push(ds.m.loaders[i]?.loader_name ?? '');
  return out;
}
