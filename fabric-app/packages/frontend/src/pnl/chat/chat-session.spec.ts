// The chat loop on recorded function outputs (ADR-0009 §1): tool calls run in
// the browser and feed the next invoke; answers end the turn; errors, thrown
// invokes and the step limit become entries; the history stays bounded.
import { CHAT_BOUNDS } from '@rayfin-app/shared';
import { describe, expect, it } from 'vitest';

import { sampleReference } from '../data/sample-reference';
import { defaultFilters } from '../model/filters';
import type { ChatTurnInput, ChatTurnOutput, ChatWireMessage } from './chat-client';
import { boundHistory, type ChatDeps, type ChatState, EMPTY_CHAT, ERROR_TEXT, sendMessage, STEP_LIMIT_TEXT, UNAVAILABLE_TEXT } from './chat-session';
import type { ToolRunResult } from './tool-runner';

const reference = sampleReference();
const current = defaultFilters(reference);

const toolResult = (name: ToolRunResult['name'], text = '{"rows":[]}'): ToolRunResult => ({ name, label: name, filter: current, view: 'kpi', summary: 'S', detail: 'd', text, error: null });

/** Deps that answer invokes from a script and record what they were sent. */
function script(outputs: (ChatTurnOutput | Error)[]) {
  const sent: ChatTurnInput[] = [];
  const ran: { name: string; argumentsJson: string }[] = [];
  const deps: ChatDeps = {
    invoke: async (turn) => {
      sent.push(turn);
      const next = outputs.shift();
      if (next === undefined) throw new Error('script exhausted');
      if (next instanceof Error) throw next;
      return next;
    },
    runTool: async (call) => {
      ran.push(call);
      return toolResult(call.name);
    },
  };
  return { deps, sent, ran };
}

const calls = (...names: ToolRunResult['name'][]): ChatTurnOutput => ({ kind: 'tool_calls', calls: names.map((name, i) => ({ id: `c${i}`, name, argumentsJson: '{}' })) });
const answer = (text: string): ChatTurnOutput => ({ kind: 'answer', text });

async function run(state: ChatState, text: string, deps: ChatDeps) {
  const snapshots: ChatState[] = [];
  const final = await sendMessage(state, text, current, deps, (s) => snapshots.push(s));
  return { final, snapshots };
}

describe('sendMessage', () => {
  it('tool_calls → runs each tool, appends the results and asks again; the answer ends the turn', async () => {
    const s = script([calls('get_kpis', 'get_bridge'), answer('Net revenue is up.')]);
    const { final, snapshots } = await run(EMPTY_CHAT, 'How are we doing?', s.deps);
    expect(final.entries.map((e) => e.kind)).toEqual(['user', 'tool', 'tool', 'assistant']);
    expect(final.busy).toBeNull();
    expect(s.ran.map((c) => c.name)).toEqual(['get_kpis', 'get_bridge']);
    // Second invoke carries user, assistant(tool calls), two tool results.
    expect(s.sent[1].messages.map((m) => m.role)).toEqual(['user', 'assistant', 'tool', 'tool']);
    expect(s.sent[1].messages[1].toolCalls?.map((c) => c.id)).toEqual(['c0', 'c1']);
    expect(s.sent[1].messages[2].toolCallId).toBe('c0');
    expect(s.sent[1].messages[3].content).toBe('{"rows":[]}');
    // Progress: thinking, reading each tool, thinking again, done.
    const busy = snapshots.map((x) => x.busy);
    expect(busy[0]).toBe('Thinking…');
    expect(busy).toContain('Reading the vitals…');
    expect(busy).toContain('Reading the bridge…');
    expect(busy[busy.length - 1]).toBeNull();
    // The history ends with the assistant's answer, ready for the next question.
    expect(final.history[final.history.length - 1]).toEqual({ role: 'assistant', content: 'Net revenue is up.', toolCallId: null, toolCalls: null });
  });

  it('stops after the step limit with a readable entry', async () => {
    const s = script(Array.from({ length: CHAT_BOUNDS.maxStepsPerTurn + 1 }, () => calls('get_context')));
    const { final } = await run(EMPTY_CHAT, 'loop', s.deps);
    expect(s.sent).toHaveLength(CHAT_BOUNDS.maxStepsPerTurn);
    const last = final.entries[final.entries.length - 1];
    expect(last).toMatchObject({ kind: 'error', text: STEP_LIMIT_TEXT });
    expect(final.busy).toBeNull();
  });

  it('maps every function error reason to its text, and a thrown invoke to "not available"', async () => {
    for (const reason of Object.keys(ERROR_TEXT) as (keyof typeof ERROR_TEXT)[]) {
      const s = script([{ kind: 'error', reason, status: null }]);
      const { final } = await run(EMPTY_CHAT, 'q', s.deps);
      expect(final.entries[1]).toMatchObject({ kind: 'error', text: ERROR_TEXT[reason] });
      expect(final.busy).toBeNull();
    }
    const thrown = script([new Error('Request timed out after 90000ms')]);
    const { final } = await run(EMPTY_CHAT, 'q', thrown.deps);
    expect(final.entries[1]).toMatchObject({ kind: 'error', text: `${UNAVAILABLE_TEXT}: Request timed out after 90000ms` });
  });

  it('ignores empty input and input while busy; trims and caps the user text', async () => {
    const s = script([answer('ok')]);
    expect(await sendMessage(EMPTY_CHAT, '   ', current, s.deps, () => {})).toBe(EMPTY_CHAT);
    const busy: ChatState = { ...EMPTY_CHAT, busy: 'Thinking…' };
    expect(await sendMessage(busy, 'hi', current, s.deps, () => {})).toBe(busy);
    const { final } = await run(EMPTY_CHAT, `  ${'x'.repeat(CHAT_BOUNDS.maxUserChars + 10)}  `, s.deps);
    expect((final.entries[0] as { text: string }).text.length).toBe(CHAT_BOUNDS.maxUserChars);
    expect(s.sent[0].messages[0].content.length).toBe(CHAT_BOUNDS.maxUserChars);
  });

  it('keeps the conversation across turns and bounds the history at user boundaries', async () => {
    let state = EMPTY_CHAT;
    const outputs: ChatTurnOutput[] = [];
    for (let i = 0; i < 20; i += 1) outputs.push(calls('get_kpis'), answer(`a${i}`));
    const s = script(outputs);
    for (let i = 0; i < 20; i += 1) state = await sendMessage(state, `q${i}`, current, s.deps, () => {});
    expect(state.history.length).toBeLessThanOrEqual(CHAT_BOUNDS.maxMessages);
    expect(state.history[0].role).toBe('user');
    expect(state.entries).toHaveLength(60);
    const last = s.sent[s.sent.length - 1].messages;
    expect(last.length).toBeLessThanOrEqual(CHAT_BOUNDS.maxMessages);
    expect(last[0].role).toBe('user');
  });
});

describe('boundHistory', () => {
  const u = (i: number): ChatWireMessage => ({ role: 'user', content: `u${i}`, toolCallId: null, toolCalls: null });
  const a = (i: number): ChatWireMessage => ({ role: 'assistant', content: `a${i}`, toolCallId: null, toolCalls: null });
  it('cuts whole exchanges from the front, never leaving an assistant or tool message first', () => {
    const history: ChatWireMessage[] = [];
    for (let i = 0; i < 15; i += 1) history.push(u(i), a(i));
    const out = boundHistory(history);
    expect(out.length).toBeLessThanOrEqual(CHAT_BOUNDS.maxMessages);
    expect(out[0].role).toBe('user');
    expect(out[out.length - 1]).toEqual(a(14));
    expect(boundHistory([a(0), u(1)])).toEqual([u(1)]);
    expect(boundHistory([])).toEqual([]);
  });
});
