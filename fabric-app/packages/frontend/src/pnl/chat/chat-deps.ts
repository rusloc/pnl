// Production wiring of the chat loop: the `chatTurn` function for the model
// call, the app data source's cached zone reader for the tools. Tests pass their
// own `ChatDeps` to the shell instead.
import { TOOL_LABEL } from '@rayfin-app/shared';

import type { ZoneReader } from '../data/data-source';
import type { PnlDataSource, ReferenceData } from '../model/types';
import { invokeChatTurn } from './chat-client';
import type { ChatDeps } from './chat-session';
import { runTool, type ToolRunResult } from './tool-runner';

export function isZoneReader(source: PnlDataSource): source is PnlDataSource & ZoneReader {
  return typeof (source as Partial<ZoneReader>).loadZone === 'function';
}

const OFFLINE = 'Figures are not available offline';

export function productionChatDeps(source: PnlDataSource, reference: ReferenceData): ChatDeps {
  return {
    invoke: invokeChatTurn,
    runTool: (call, current) => {
      if (isZoneReader(source)) return runTool(call, { reader: source, reference, current });
      const result: ToolRunResult = { name: call.name, label: TOOL_LABEL[call.name], filter: null, view: 'pnl', summary: 'Unavailable', detail: OFFLINE, text: JSON.stringify({ error: OFFLINE }), error: OFFLINE };
      return Promise.resolve(result);
    },
  };
}
