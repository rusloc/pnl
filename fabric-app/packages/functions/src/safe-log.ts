// The only logging path of the chat function (ADR-0009 §8.2: no prompt or
// answer content is ever logged). The shape is closed: an event name from a
// fixed list plus numbers. Nothing here can carry a message, a header or a
// provider body, and `scripts/guard-chat-function.mjs` fails the build if any
// other file in this package calls `console.*` directly.

export type ChatLogEvent = 'chat_turn' | 'chat_turn_rejected' | 'chat_provider_error' | 'chat_provider_timeout';

export interface ChatLogRecord {
  event: ChatLogEvent;
  /** Wall time of the turn, ms. */
  ms?: number;
  /** Provider HTTP status, when there was a response. */
  status?: number;
  /** Messages in the request. */
  messages?: number;
  /** Characters of all message contents in the request (size, not content). */
  inChars?: number;
  /** Characters of the answer or of the tool-call arguments returned. */
  outChars?: number;
  /** Tool calls returned to the browser. */
  toolCalls?: number;
}

const NUMERIC_KEYS: readonly (keyof Omit<ChatLogRecord, 'event'>)[] = ['ms', 'status', 'messages', 'inChars', 'outChars', 'toolCalls'];

/** Emits one line of numbers; any non-numeric field is dropped, never stringified. */
export function logEvent(record: ChatLogRecord): void {
  const safe: Record<string, number | string> = { event: record.event };
  for (const key of NUMERIC_KEYS) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) safe[key] = Math.round(value);
  }
  console.log(JSON.stringify(safe));
}
