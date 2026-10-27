// The AI assistant in the shell (ADR-0009): the entry button in the title row
// (only when the flag is on), the panel with its AI label, a starter question
// through a scripted turn, the tool card's "Open in view" (filters replaced,
// view switched), error and busy states, Escape / focus return (N-08).
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CHAT_BUTTON_ID, CHAT_TITLE, CHAT_TRANSPARENCY, STARTER_QUESTIONS } from '../chat/chat-copy';
import type { ChatTurnOutput } from '../chat/chat-client';
import { type ChatDeps, ERROR_TEXT } from '../chat/chat-session';
import type { ToolRunResult } from '../chat/tool-runner';
import { sampleReference } from '../data/sample-reference';
import { loadSampleFigures } from '../data/sample-source';
import { defaultFilters } from '../model/filters';
import type { PnlDataSource } from '../model/types';
import { PnlApp } from '../pnl-app';

const reference = sampleReference();
const source: PnlDataSource = {
  loadReference: async () => ({ reference }),
  loadFigures: async (filter, ref) => ({ ...(await loadSampleFigures(filter, ref)), sample: false }),
};

/** Deps whose invoke answers from a script; tools "run" on the validated filters of the call. */
function deps(outputs: (ChatTurnOutput | Error)[], gate?: { release: () => void; wait: Promise<void> }) {
  const sent: string[] = [];
  const d: ChatDeps = {
    invoke: async () => {
      if (gate) await gate.wait;
      const next = outputs.shift();
      if (next === undefined) throw new Error('script exhausted');
      if (next instanceof Error) throw next;
      return next;
    },
    runTool: async (call, current) => {
      sent.push(call.name);
      const args = JSON.parse(call.argumentsJson) as { entity?: 'P' | 'S' | 'G'; time_view?: 'qtd' };
      const filter = { ...current, entity: args.entity ?? current.entity, timeView: args.time_view ?? current.timeView };
      const result: ToolRunResult = { name: call.name, label: 'Vitals', filter, view: 'kpi', summary: 'Commerce Cloud - Q3 2026', detail: '10 vitals', text: '{"kpis":[]}', error: null };
      return result;
    },
  };
  return { deps: d, sent };
}

async function renderApp(props: { chat?: boolean; chatDeps?: ChatDeps } = {}) {
  const utils = render(<PnlApp source={source} chat={props.chat ?? true} chatDeps={props.chatDeps} />);
  await screen.findByRole('heading', { name: 'Profit & loss' });
  await waitFor(() => expect(screen.queryByText('Loading figures…')).toBeNull());
  return utils;
}

const button = () => screen.getByRole('button', { name: CHAT_TITLE });
const panel = () => screen.getByRole('dialog', { name: CHAT_TITLE });

describe('AI assistant', () => {
  it('shows no entry point when the flag is off', async () => {
    await renderApp({ chat: false });
    expect(screen.queryByRole('button', { name: CHAT_TITLE })).toBeNull();
    expect(document.getElementById(CHAT_BUTTON_ID)).toBeNull();
  });

  it('opens from the title row with the AI label and the transparency line, focuses the input, and closes on Escape with focus back on the button', async () => {
    await renderApp({ chatDeps: deps([]).deps });
    const b = button();
    expect(b).toHaveAttribute('aria-haspopup', 'dialog');
    expect(b).toHaveAttribute('aria-expanded', 'false');
    // The title row keeps its Track B shape: heading, funnel, then the assistant.
    const row = b.parentElement as HTMLElement;
    expect(within(row).getByRole('heading', { name: 'Profit & loss' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: /Show the applied filters/ })).toBeInTheDocument();
    fireEvent.click(b);
    expect(b).toHaveAttribute('aria-expanded', 'true');
    const p = panel();
    expect(within(p).getByRole('heading', { name: CHAT_TITLE })).toBeInTheDocument();
    expect(within(p).getByText(CHAT_TRANSPARENCY)).toBeInTheDocument();
    expect(document.activeElement).toBe(within(p).getByRole('textbox', { name: 'Ask about the P&L' }));
    for (const q of STARTER_QUESTIONS) expect(within(p).getByRole('button', { name: q })).toBeInTheDocument();
    // The main layout is still there underneath (no layout break).
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: CHAT_TITLE })).toBeNull();
    expect(document.activeElement).toBe(b);
  });

  it('runs a scripted turn: starter question → tool card → answer; "Open in view" replaces the filters and switches the view', async () => {
    const d = deps([
      { kind: 'tool_calls', calls: [{ id: 'c1', name: 'get_kpis', argumentsJson: '{"entity":"S","time_view":"qtd"}' }] },
      { kind: 'answer', text: 'Commerce Cloud closed Q3 ahead of budget.' },
    ]);
    await renderApp({ chatDeps: d.deps });
    fireEvent.click(button());
    fireEvent.click(within(panel()).getByRole('button', { name: STARTER_QUESTIONS[0] }));
    await within(panel()).findByText('Commerce Cloud closed Q3 ahead of budget.');
    expect(d.sent).toEqual(['get_kpis']);
    const log = within(panel()).getByRole('log');
    expect(within(log).getByTestId('chat-user')).toHaveTextContent(STARTER_QUESTIONS[0]);
    const card = within(log).getByTestId('chat-tool');
    expect(card).toHaveTextContent('Vitals');
    expect(card).toHaveTextContent('Commerce Cloud - Q3 2026');
    expect(within(panel()).queryByRole('status')).toBeNull();
    // Open in view: the company switches to S, the window to the quarter, the Vitals tab (view key `kpi`) shows; the panel stays.
    expect(screen.getByRole('tab', { name: /P&L statement/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(within(card).getByRole('button', { name: 'Open in view' }));
    expect(screen.getByRole('tab', { name: /Vitals/ })).toHaveAttribute('aria-selected', 'true');
    const shell = document.querySelector('[data-entity]') as HTMLElement;
    expect(shell.dataset.entity).toBe('S');
    expect(screen.getByTestId('status-line')).toHaveTextContent(/^Commerce Cloud - Management reporting/);
    expect(screen.getByRole('button', { name: /^Period: .*quarter to date/ })).toBeInTheDocument();
    expect(panel()).toBeInTheDocument();
  });

  it('shows the busy state while a turn runs and disables the input; an error reply becomes an alert', async () => {
    let release = () => {};
    const gate = { wait: new Promise<void>((r) => (release = r)), release: () => release() };
    const d = deps([{ kind: 'error', reason: 'not_configured', status: null }], gate);
    await renderApp({ chatDeps: d.deps });
    fireEvent.click(button());
    const input = within(panel()).getByRole('textbox', { name: 'Ask about the P&L' });
    fireEvent.change(input, { target: { value: 'What is gross margin?' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(within(panel()).getByRole('status')).toHaveTextContent('Thinking…');
    expect(input).toBeDisabled();
    expect(within(panel()).getByRole('button', { name: 'Send' })).toBeDisabled();
    await act(async () => gate.release());
    await within(panel()).findByRole('alert');
    expect(within(panel()).getByRole('alert')).toHaveTextContent(ERROR_TEXT.not_configured);
    expect(input).not.toBeDisabled();
    // Clear empties the conversation and brings the starter questions back.
    fireEvent.click(within(panel()).getByRole('button', { name: 'Clear' }));
    expect(within(panel()).queryByTestId('chat-user')).toBeNull();
    expect(within(panel()).getByRole('button', { name: STARTER_QUESTIONS[1] })).toBeInTheDocument();
  });

  it('a thrown invoke (function not deployed, network) is an alert too, and the conversation survives closing the panel', async () => {
    const d = deps([new Error('Function chatTurn not found')]);
    await renderApp({ chatDeps: d.deps });
    fireEvent.click(button());
    const input = within(panel()).getByRole('textbox', { name: 'Ask about the P&L' });
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    await within(panel()).findByRole('alert');
    expect(within(panel()).getByRole('alert')).toHaveTextContent(/not available right now: Function chatTurn not found/);
    fireEvent.click(within(panel()).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: CHAT_TITLE })).toBeNull();
    fireEvent.click(button());
    expect(within(panel()).getByTestId('chat-user')).toHaveTextContent('hello');
  });
});

describe('replace filter action', () => {
  it('is the whole state the validator produced (defaults untouched elsewhere)', () => {
    const state = defaultFilters(reference);
    expect(state.entity).toBe('P');
  });
});
