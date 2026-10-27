// Wire contract of the `chatTurn` function (ADR-0009 §2). These types are
// declared here, not in @rayfin-app/shared, on purpose: Rayfin's type generator
// expands types it finds in source files structurally into `types.ts`, but keeps
// types that come from a declaration file (a built workspace package) by name,
// which the frontend could not resolve. No optional properties either: the
// generator would widen them to `T | undefined`.
import type { ChatToolName } from '@rayfin-app/shared';

export interface ChatToolCall {
  /** The provider's call id; echoed back on the tool message. */
  id: string;
  name: ChatToolName;
  /** The model's arguments, verbatim JSON text; the browser validates them. */
  argumentsJson: string;
}

export interface ChatInMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  /** Set on `tool` messages: the call this result answers. */
  toolCallId: string | null;
  /** Set on `assistant` messages that asked for tools. */
  toolCalls: ChatToolCall[] | null;
}

/** One turn = the bounded conversation so far; the function keeps no state. */
export interface ChatTurnInput {
  messages: ChatInMessage[];
}

export type ChatErrorReason =
  /** The provider endpoint / deployment are not configured on this deployment. */
  | 'not_configured'
  /** The request violated the bounds (too long, bad role order, unknown tool). */
  | 'bad_request'
  /** The provider rejected the app identity (401 / 403). */
  | 'auth'
  /** The provider answered with a non-success status or an unreadable body. */
  | 'provider'
  /** The provider did not answer within the budget. */
  | 'timeout'
  /** The provider's content filter stopped the response. */
  | 'filtered';

export type ChatTurnOutput =
  | { kind: 'answer'; text: string }
  | { kind: 'tool_calls'; calls: ChatToolCall[] }
  | { kind: 'error'; reason: ChatErrorReason; status: number | null };
