// Analysis (L-08, C-40, C-45; redesign v4 build-brief §2). Page 1: the net
// revenue bridge (comparison → drivers at constant currency → CC subtotal → FX →
// actual) and the profit bridge (comparison Adj. EBITDA → actual → operating
// profit). Page 2: the largest variances to operating profit with Top 8 / 12 /
// All, By block / By |Δ|, a slice cut (stacked member segments, ▸ member
// lists, "alloc." tags), the vs Compare B column (dropped on None, PV-05), of
// which FX, n.m., one shared bar scale and the coverage footer.
import { useState } from 'react';

import { cn } from '@/lib/utils';

import { regionColour } from '../components/charts/region-colours';
import { Waterfall } from '../components/charts/waterfall';
import type { Page } from '../components/pager';
import { Panel } from '../components/panel';
import { Segmented } from '../components/ui/segmented';
import { ChevronIcon } from '../components/ui/icons';
import { bridgeComparison, varCutLabel, varCutsFor, VERSION_SHORT } from '../model/filters';
import { PANEL_INFO } from '../model/info-popovers';
import { sampleGate } from '../model/sample-mode';
import type { DeltaTone, Figures, FilterState, InfoCopy, ReferenceData, VarCut } from '../model/types';
import { largestVariances, VARIANCE_BLOCKS, type VarMode, type VarRow, type VarTop } from '../model/variances';

const TEXT: Record<DeltaTone, string> = { ahead: 'text-fav', off: 'text-unf', watch: 'text-notice-icon', plan: 'text-slate-600', neutral: 'text-ink-900' };

export interface VarianceControls {
  top: VarTop;
  mode: VarMode;
  onTop: (top: VarTop) => void;
  onMode: (mode: VarMode) => void;
  onCut: (cut: VarCut) => void;
}

interface AnalysisViewProps {
  figures: Figures;
  filter: FilterState;
  reference: ReferenceData;
  page: Page;
  controls: VarianceControls;
}

interface Segment {
  key: string;
  title: string;
  left: number;
  width: number;
  colour: string;
}

/** Segments of a diverging bar (% of the track): positives stack right from the centre, negatives left; one scale for every row. */
function barSegments(row: VarRow, scale: number, legend: readonly { key: string }[]): Segment[] {
  const order = new Map(legend.map((l, i) => [l.key, i]));
  const members = row.members.length > 0 ? row.members : [{ key: 'all', label: row.label, delta: row.delta, text: row.deltaText }];
  const out: Segment[] = [];
  let right = 50;
  let left = 50;
  for (const m of members) {
    const width = Math.max(0.5, (Math.abs(m.delta) / scale) * 48);
    const colour = row.members.length > 0 ? regionColour(order.get(m.key) ?? 0).fill : m.delta < 0 ? '#E2804A' : '#3BA37B';
    if (m.delta >= 0) {
      out.push({ key: m.key, title: `${m.label} ${m.text}`, left: right, width, colour });
      right += width;
    } else {
      left -= width;
      out.push({ key: m.key, title: `${m.label} ${m.text}`, left, width, colour });
    }
  }
  return out;
}

function DivergingBar({ row, scale, legend }: { row: VarRow; scale: number; legend: readonly { key: string }[] }) {
  return (
    <div aria-hidden="true" className="relative mx-[6px] h-[10px] rounded-[2px] bg-line-100" data-testid="variance-bar">
      <div className="absolute bottom-[-2px] left-1/2 top-[-2px] w-px bg-ink-900/45" />
      {barSegments(row, scale, legend).map((s) => (
        <span key={s.key} className="absolute bottom-0 top-0" style={{ left: `${s.left}%`, width: `${s.width}%`, backgroundColor: s.colour }} title={s.title} />
      ))}
    </div>
  );
}

const COLS = 'grid-cols-[minmax(200px,1.6fr)_80px_80px_minmax(120px,1fr)_76px_64px_76px_76px]';

export function AnalysisView({ figures, filter, reference, page, controls }: AnalysisViewProps) {
  // "All" opens with every block collapsed so the page still fits; Top 8 / 12 open expanded. The user's
  // toggles are kept with the Top they were made under, so a Top change starts from that default again.
  const [collapsedFor, setCollapsedFor] = useState<{ top: VarTop; set: ReadonlySet<string> } | null>(null);
  const collapsed: ReadonlySet<string> = collapsedFor?.top === controls.top ? collapsedFor.set : controls.top === 'all' ? new Set(VARIANCE_BLOCKS) : new Set();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const comparison = VERSION_SHORT[bridgeComparison(filter)];
  const hasPy = filter.compareB !== 'NONE';
  const vm = largestVariances(figures.variances.leaves, figures.variancesCut, { top: controls.top, mode: controls.mode, collapsed }, filter.units, hasPy);
  const toggleBlock = (code: string) => {
    const next = new Set(collapsed);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setCollapsedFor({ top: controls.top, set: next });
  };
  const toggleMembers = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const cutOptions = varCutsFor(filter.entity).map((cut) => ({ value: cut, label: varCutLabel(cut, filter.entity, reference) }));
  const cutZone = figures.zones.variancesCut;
  const varZone = figures.zones.variances;
  const empty = figures.variances.leaves.length === 0;

  if (page === 1) {
    return (
      <div id="view-ana" className="grid min-h-[460px] flex-auto gap-[12px] [grid-template-columns:1fr_1fr]" data-page="1">
        <Panel id="nr-bridge" title="Net revenue bridge" info={figures.bridge.info} zone={figures.zones.bridge} what="net revenue bridge" empty={figures.bridge.steps.length === 0}>
          <Waterfall bridge={figures.bridge} />
        </Panel>
        <Panel
          id="profit-bridge"
          title={`Profit bridge: ${comparison} Adj. EBITDA → Actual → Operating profit`}
          info={figures.profit.info}
          zone={figures.zones.profit}
          what="profit bridge"
          empty={figures.profit.steps.length === 0}
        >
          <Waterfall bridge={figures.profit} dense />
        </Panel>
      </div>
    );
  }

  const toolbar = (
    <span className="ml-[8px] flex flex-wrap items-center gap-[8px]" data-testid="variances-toolbar">
      <Segmented
        label="Top"
        variant="inline"
        value={String(controls.top)}
        options={[
          { value: '8', label: 'Top 8' },
          { value: '12', label: '12' },
          { value: 'all', label: 'All' },
        ]}
        onChange={(v) => controls.onTop(v === 'all' ? 'all' : v === '12' ? 12 : 8)}
      />
      <Segmented
        label="Grouping"
        variant="inline"
        value={controls.mode}
        options={[
          { value: 'block', label: 'By block' },
          { value: 'abs', label: 'By |Δ|' },
        ]}
        onChange={(v) => controls.onMode(v as VarMode)}
      />
      <Segmented label="Cut" variant="inline" value={filter.varCut} options={sampleGate(cutOptions, figures.sample)} onChange={(v) => controls.onCut(v as VarCut)} />
    </span>
  );

  return (
    <div id="view-ana" className="flex min-h-[460px] flex-auto flex-col" data-page="2">
      <Panel id="variances" title={`Largest variances vs ${comparison}`} info={varInfo(figures, vm.coverage)} zone={varZone} what="largest variances" empty={empty} toolbar={toolbar} className="min-h-0 flex-auto">
        {vm.legend.length > 0 && (
          <div className="flex flex-none flex-wrap items-center gap-[12px] text-[11.5px] text-slate-600" data-testid="variances-legend">
            {vm.legend.map((l, i) => (
              <span key={l.key} className="inline-flex items-center gap-[5px]">
                <span aria-hidden="true" className="inline-block h-[9px] w-[9px] rounded-full" style={{ backgroundColor: regionColour(i).fill }} />
                {l.label}
              </span>
            ))}
            {cutZone.kind === 'loading' && <span>reading the cut…</span>}
            {cutZone.kind === 'error' && <span className="text-notice-text">cut unavailable: {cutZone.reason}</span>}
          </div>
        )}
        {filter.varCut !== 'none' && vm.legend.length === 0 && cutZone.kind === 'loading' && <span className="text-[11.5px] text-slate-600">Reading the cut from the semantic model…</span>}
        <div className="min-h-0 flex-auto overflow-auto font-ledger-condensed text-[12.5px] tabular-nums" data-testid="variances-table">
          <div className={cn('grid border-b border-line-300 text-[11.5px] font-semibold text-slate-600', COLS)}>
            <div className="py-[4px] pr-[6px]">Line</div>
            <div className="px-[6px] py-[4px] text-right">{comparison}</div>
            <div className="px-[6px] py-[4px] text-right">{VERSION_SHORT[filter.baseVersion]}</div>
            <div className="px-[6px] py-[4px] text-center">Unfavourable - Favourable</div>
            <div className="px-[6px] py-[4px] text-right">Δ</div>
            <div className="px-[6px] py-[4px] text-right">Δ %</div>
            <div className="px-[6px] py-[4px] text-right">{hasPy ? `vs ${VERSION_SHORT[filter.compareB as Exclude<FilterState['compareB'], 'NONE'>]}` : ''}</div>
            <div className="py-[4px] pl-[6px] text-right">of which FX</div>
          </div>
          {vm.rows.map((r) => (
            <VarianceRow key={r.key} row={r} vm={vm} flat={controls.mode === 'abs'} expanded={expanded.has(r.key)} onToggleBlock={toggleBlock} onToggleMembers={toggleMembers} />
          ))}
          <div className="mt-[4px] border-t-2 border-line-300" />
          {vm.footer.map((r) => (
            <VarianceRow key={r.key} row={r} vm={vm} flat={false} expanded={false} onToggleBlock={toggleBlock} onToggleMembers={toggleMembers} />
          ))}
        </div>
      </Panel>
    </div>
  );
}

/** The variances ⓘ with the live counts (lines to operating profit, coverage of the shown lines). */
function varInfo(figures: Figures, coverage: number): InfoCopy {
  return {
    ...PANEL_INFO.VAR,
    values: [
      { label: 'Lines to operating profit', value: String(figures.variances.leaves.filter((l) => VARIANCE_BLOCKS.includes(l.block)).length) },
      { label: 'Coverage of the shown lines', value: `${Math.round(coverage * 100)}%` },
    ],
  };
}

interface RowProps {
  row: VarRow;
  vm: ReturnType<typeof largestVariances>;
  /** By |Δ|: leaves carry their block name as a grey suffix. */
  flat: boolean;
  expanded: boolean;
  onToggleBlock: (code: string) => void;
  onToggleMembers: (key: string) => void;
}

function VarianceRow({ row, vm, flat, expanded, onToggleBlock, onToggleMembers }: RowProps) {
  const block = row.kind === 'block';
  const footer = row.kind === 'footer';
  const expandable = row.kind === 'leaf' && row.members.length > 0;
  const cell = 'px-[6px] py-[3px] text-right';
  const tone = TEXT[row.tone];
  return (
    <>
      <div
        className={cn(
          'grid items-center border-b border-line-100',
          COLS,
          (block || footer) && 'bg-subtle font-semibold',
          row.alloc && 'italic text-slate-600'
        )}
        data-testid={`variance-${row.kind}`}
        data-key={row.key}
      >
        <div className={cn('flex min-w-0 items-center gap-[4px] py-[3px] pr-[6px]', row.kind === 'leaf' && 'pl-[14px]')}>
          {block && (
            <button type="button" onClick={() => onToggleBlock(row.key)} aria-expanded={!row.collapsed} aria-label={`${row.collapsed ? 'Expand' : 'Collapse'} ${row.label}`} className="flex h-[18px] w-[18px] flex-none cursor-pointer items-center justify-center border-0 bg-transparent p-0">
              <ChevronIcon open={!row.collapsed} />
            </button>
          )}
          {expandable && (
            <button type="button" onClick={() => onToggleMembers(row.key)} aria-expanded={expanded} aria-label={`${expanded ? 'Hide' : 'Show'} members of ${row.label}`} className="flex h-[18px] w-[18px] flex-none cursor-pointer items-center justify-center border-0 bg-transparent p-0">
              <ChevronIcon open={expanded} />
            </button>
          )}
          <span className="truncate">{row.label}</span>
          {block && <span className="text-[11px] font-normal text-slate-600">{row.count}</span>}
          {row.kind === 'leaf' && flat && row.blockName && <span className="truncate text-[11px] text-slate-600">{row.blockName}</span>}
          {row.alloc && <span className="rounded-[4px] border border-dashed border-slate-400 px-[4px] font-ledger text-[10px] not-italic text-slate-600">alloc.</span>}
        </div>
        <div className={cell}>{row.comparison}</div>
        <div className={cell}>{row.actual}</div>
        <div>{!footer || row.key === 'TOTAL' ? <DivergingBar row={row} scale={vm.scale} legend={vm.legend} /> : null}</div>
        <div className={cn(cell, 'font-semibold', tone)}>{row.deltaText}</div>
        <div className={cn(cell, row.deltaPct === 'n.m.' ? 'text-slate-400' : tone)}>{row.deltaPct}</div>
        <div className={cell}>{row.py}</div>
        <div className={cn(cell, 'pl-[6px]')}>{row.fx}</div>
      </div>
      {expandable &&
        expanded &&
        row.members.map((m) => (
          <div key={m.key} className={cn('grid items-center border-b border-line-100 bg-[#FAFBFC] text-slate-600', COLS)} data-testid="variance-member">
            <div className="truncate py-[2px] pl-[36px] pr-[6px]">{m.label}</div>
            <div />
            <div />
            <div>
              <DivergingBar row={{ ...row, members: [], delta: m.delta, deltaText: m.text, label: m.label }} scale={vm.scale} legend={vm.legend} />
            </div>
            <div className={cn(cell, m.delta < 0 ? 'text-unf' : m.delta > 0 ? 'text-fav' : '')}>{m.text}</div>
            <div />
            <div />
            <div />
          </div>
        ))}
    </>
  );
}
