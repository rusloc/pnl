// The one place the frontend invokes the `chatTurn` function (ADR-0009 §2):
// typed by the generated `AppFunctionsSchema`, one JSON POST per turn, bounded
// by the shared invoke budget. The browser carries the conversation; the
// function keeps no state.
import type { AppFunctionsSchema } from '@rayfin-app/functions/types';
import { CHAT_BOUNDS } from '@rayfin-app/shared';

import { getRayfinClient } from '@/lib/rayfin-client';

export type ChatTurnInput = AppFunctionsSchema['chatTurn']['input']['turn'];
export type ChatTurnOutput = AppFunctionsSchema['chatTurn']['output'];
export type ChatWireMessage = ChatTurnInput['messages'][number];
export type ChatWireToolCall = NonNullable<ChatWireMessage['toolCalls']>[number];

export async function invokeChatTurn(turn: ChatTurnInput): Promise<ChatTurnOutput> {
  const client = await getRayfinClient();
  return client.functions.chatTurn.invoke({ turn }, { timeoutMs: CHAT_BOUNDS.invokeTimeoutMs });
}
