import type { Manifest } from '../data/manifest.ts';
import { CHAT_LIMITS } from './limits.ts';
import { SYSTEM_PROMPT } from './system-prompt.ts';
import { createChatTools } from './tools.ts';

// Public surface of the Track C chat layer (ADR-0009 §4) for the host app in the vosk.dev repo.

export { CHAT_LIMITS } from './limits.ts';
export { SYSTEM_PROMPT } from './system-prompt.ts';
export * from './tools.ts';
export * from './runner.ts';

/**
 * What the relay needs and cannot import from the browser bundle: the system prompt, the tool definitions and the
 * limits. Written to .sync/track-c/chat-tools.json by scripts/export-chat-tools.ts; a test keeps the file current.
 */
export function chatToolsJson(m: Manifest): string {
  const contract = {
    schemaVersion: 1,
    systemPrompt: SYSTEM_PROMPT,
    tools: createChatTools(m).definitions,
    limits: CHAT_LIMITS,
  };
  return `${JSON.stringify(contract, null, 2)}\n`;
}
