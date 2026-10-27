// The chat loop (ADR-0009 §1): the browser owns the conversation; each turn is
// one function invoke, and a `tool_calls` reply runs the tools here and asks
// again, at most CHAT_BOUNDS.maxStepsPerTurn times. Pure given its deps, so the
// loop is tested with recorded function outputs and a fake tool runner.
import { CHAT_BOUNDS, type ChatToolName } from '@rayfin-app/shared';

import type { FilterState } from '../model/types';
import type { ChatTurnInput, ChatTurnOutput, ChatWireMessage } from './chat-client';
import type { ToolRunResult } from './tool-runner';

export type ChatEntryBody =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool'; result: ToolRunResult }
  | { kind: 'error'; text: string };

export type ChatEntry = ChatEntryBody & { id: number };

export interface ChatDeps {
  invoke(turn: ChatTurnInput): Promise<ChatTurnOutput>;
  runTool(call: { name: ChatToolName; argumentsJson: string }, current: FilterState): Promise<ToolRunResult>;
}

export interface ChatState {
  entries: ChatEntry[];
  /** What the assistant is doing now; null when idle. */
  busy: string | null;
  /** The wire conversation sent on the next turn (bounded). */
  history: ChatWireMessage[];
  nextId: number;
}

export const EMPTY_CHAT: ChatState = { entries: [], busy: null, history: [], nextId: 1 };

export const ERROR_TEXT: Record<Extract<ChatTurnOutput, { kind: 'error' }>['reason'], string> = {
  not_configured: 'The assistant is not set up on this deployment yet (no model endpoint configured).',
  bad_request: 'The conversation got too long for one turn. Clear it and ask again.',
  auth: 'The app is not allowed to use the AI model (sign-in or role missing on the Azure OpenAI resource).',
  provider: 'The AI model did not answer. Try again in a moment.',
  timeout: 'The AI model took too long to answer. Try a simpler question.',
  filtered: 'The AI model declined to answer this.',
};

export const STEP_LIMIT_TEXT = 'The assistant needed too many look-ups for one question. Try a narrower question.';
export const UNAVAILABLE_TEXT = 'The assistant is not available right now';

const user = (content: string): ChatWireMessage => ({ role: 'user', content, toolCallId: null, toolCalls: null });

/** Keep the last messages within the bound, cutting only at a user message so no tool result is orphaned. */
export function boundHistory(history: ChatWireMessage[]): ChatWireMessage[] {
  let out = history;
  while (out.length > CHAT_BOUNDS.maxMessages || (out.length > 0 && out[0].role !== 'user')) {
    const next = out.findIndex((m, i) => i > 0 && m.role === 'user');
    if (next === -1) return out.length > 0 && out[0].role === 'user' && out.length <= CHAT_BOUNDS.maxMessages ? out : out.slice(-1).filter((m) => m.role === 'user');
    out = out.slice(next);
  }
  return out;
}

/**
 * One user message → the assistant's answer (and the tool cards on the way).
 * `emit` receives every intermediate state so the panel can show progress.
 */
export async function sendMessage(state: ChatState, text: string, current: FilterState, deps: ChatDeps, emit: (s: ChatState) => void): Promise<ChatState> {
  const trimmed = text.trim().slice(0, CHAT_BOUNDS.maxUserChars);
  if (trimmed.length === 0 || state.busy !== null) return state;
  let s: ChatState = { ...state, history: boundHistory([...state.history, user(trimmed)]) };
  const push = (entry: ChatEntryBody, busy: string | null, historyTail: ChatWireMessage[] = []) => {
    s = { entries: [...s.entries, { ...entry, id: s.nextId }], busy, history: [...s.history, ...historyTail], nextId: s.nextId + 1 };
    emit(s);
  };
  push({ kind: 'user', text: trimmed }, 'Thinking…');

  for (let step = 0; step < CHAT_BOUNDS.maxStepsPerTurn; step += 1) {
    let out: ChatTurnOutput;
    try {
      out = await deps.invoke({ messages: s.history });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      push({ kind: 'error', text: `${UNAVAILABLE_TEXT}: ${reason}` }, null);
      return s;
    }
    if (out.kind === 'error') {
      push({ kind: 'error', text: ERROR_TEXT[out.reason] }, null);
      return s;
    }
    if (out.kind === 'answer') {
      push({ kind: 'assistant', text: out.text }, null, [{ role: 'assistant', content: out.text, toolCallId: null, toolCalls: null }]);
      return s;
    }
    s = { ...s, history: [...s.history, { role: 'assistant', content: '', toolCallId: null, toolCalls: out.calls }] };
    for (const call of out.calls) {
      s = { ...s, busy: `Reading the ${toolBusyLabel(call.name)}…` };
      emit(s);
      const result = await deps.runTool({ name: call.name, argumentsJson: call.argumentsJson }, current);
      push({ kind: 'tool', result }, 'Thinking…', [{ role: 'tool', content: result.text, toolCallId: call.id, toolCalls: null }]);
    }
  }
  push({ kind: 'error', text: STEP_LIMIT_TEXT }, null);
  return s;
}

function toolBusyLabel(name: ChatToolName): string {
  switch (name) {
    case 'get_statement':
      return 'statement';
    case 'get_kpis':
      return 'vitals';
    case 'get_bridge':
      return 'bridge';
    case 'get_largest_variances':
      return 'variances';
    case 'get_profitability':
      return 'profitability table';
    case 'get_context':
      return 'applied filters';
    case 'explain_line':
      return 'line definition';
    case 'explain_kpi':
      return 'key figure definition';
  }
}
