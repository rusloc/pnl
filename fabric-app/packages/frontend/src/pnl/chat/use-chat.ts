// React binding of the chat loop: one conversation per shell, kept while the
// panel is closed; `send` always runs the tools on the filters the user is
// looking at right now (unspecified tool arguments inherit them).
import { useCallback, useEffect, useRef, useState } from 'react';

import type { FilterState } from '../model/types';
import { type ChatDeps, type ChatState, EMPTY_CHAT, sendMessage } from './chat-session';

export interface ChatHandle {
  state: ChatState;
  send: (text: string) => Promise<void>;
  clear: () => void;
}

export function useChat(deps: ChatDeps, current: FilterState): ChatHandle {
  const [state, setState] = useState<ChatState>(EMPTY_CHAT);
  const stateRef = useRef<ChatState>(EMPTY_CHAT);
  const currentRef = useRef<FilterState>(current);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  const send = useCallback(
    async (text: string) => {
      const apply = (s: ChatState) => {
        stateRef.current = s;
        setState(s);
      };
      apply(await sendMessage(stateRef.current, text, currentRef.current, deps, apply));
    },
    [deps]
  );
  const clear = useCallback(() => {
    if (stateRef.current.busy !== null) return;
    stateRef.current = EMPTY_CHAT;
    setState(EMPTY_CHAT);
  }, []);
  return { state, send, clear };
}
