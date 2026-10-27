// Company identity colours (design brief §2): one accent per company, swapped
// on the entity switch; the layout never changes (L-10). Applied as CSS
// variables on the app root so Tailwind utilities (`bg-acc`, `text-acc`,
// `bg-acc-t`, `border-key-rule`) follow the selected company.
import type { EntityCode } from '../model/types';

export interface CompanyTheme {
  acc: string;
  accT: string;
  keyRule: string;
  short: string;
}

export const COMPANY_THEME: Record<EntityCode, CompanyTheme> = {
  P: { acc: '#2453A6', accT: '#E8EEF8', keyRule: '#B9C8E4', short: 'Consumer Products' },
  S: { acc: '#6B48C8', accT: '#F0EBFB', keyRule: '#CFC2F0', short: 'Commerce Cloud' },
  G: { acc: '#3B4A5E', accT: '#EAEDF1', keyRule: '#C5CCD5', short: 'ACME Group' },
};

export interface CompanyCard {
  code: EntityCode;
  name: string;
  sub: string;
}

export const COMPANIES: readonly CompanyCard[] = [
  { code: 'P', name: 'Consumer Products', sub: 'Goods - retail, D2C, marketplaces' },
  { code: 'S', name: 'Commerce Cloud', sub: 'E-commerce SaaS services' },
  { code: 'G', name: 'ACME Group', sub: 'Consolidated' },
];

export function themeVars(code: EntityCode): Record<`--${string}`, string> {
  const t = COMPANY_THEME[code];
  return { '--acc': t.acc, '--acc-t': t.accT, '--key-rule': t.keyRule };
}
