// Chat guard-rail numbers: ADR-0009 §4, tightened for a small CPU model (.sync/2026-10-23-track-c-chat-backend.md
// §1.3: every prompt token costs CPU seconds). The browser enforces the turn, history and result caps; the relay in
// the vosk.dev repo enforces the request, message and output caps again on its side (it never trusts the browser).

export const CHAT_LIMITS = {
  /** LLM calls per user turn; the last one is sent with tool_choice "none", so it must answer in text. */
  maxStepsPerTurn: 3,
  /** Tool calls run per user turn, across all steps; later calls get a "limit reached" result. */
  maxToolCallsPerTurn: 4,
  /** Rows in one tool result (ADR-0009 §4 allows 60; the result-size cap below binds first). */
  maxRows: 30,
  /** One tool result as sent to the LLM (JSON), ≈ 400 tokens at ~4 characters per token. */
  maxResultChars: 1_600,
  /** Messages sent per request: whole turns are dropped from the front to stay within this. */
  maxHistoryMessages: 6,
  /** One user message. */
  maxMessageChars: 1_000,
  /** One browser → relay request body (JSON). */
  maxRequestChars: 16_000,
  /** Output tokens per LLM call (relay-side `max_tokens`). */
  maxOutputTokens: 300,
  /** Fixed prefix the relay adds to every call: system prompt + tool definitions, in tokens (≈ characters / 4). */
  maxPrefixTokens: 1_200,
} as const;
