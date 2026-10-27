// Rayfin functions of the ACME P&L app. One function: `chatTurn`, the LLM call
// of the AI chat (ADR-0009 §2). It declares the `AzureAI` audience only — the
// Entra token of the app item owner for the Azure OpenAI resource — and no
// data access of any kind: the tools run in the browser as the signed-in user
// through the `pnlModel` connector, so RLS holds by construction.
import { AudienceType, type RayfinContext, UserDataFunctions } from '@microsoft/fabric-user-data-functions';

import type { ProviderConfig } from './azure-openai.js';
import type { ChatTurnInput, ChatTurnOutput } from './chat-contract.js';
import { ProviderConfigError, runChatTurn } from './chat-turn.js';

const udf = new UserDataFunctions();

/** Chat-completions API version used unless `AZURE_OPENAI_API_VERSION` is set. */
const DEFAULT_API_VERSION = '2024-10-21';

/**
 * Endpoint and deployment come from the deployment's secret store (`rayfin.yml`
 * `secrets:`, values set with `npx rayfin secret set …`; `local.settings.json`
 * locally). They are configuration, not credentials, but the store is the one
 * per-deployment channel a function has — nothing is hard-coded here.
 */
function providerConfig(ctx: RayfinContext<Record<string, never>, AudienceType.AzureAI>): ProviderConfig {
  let endpoint: string;
  let deployment: string;
  try {
    endpoint = ctx.Secrets.AZURE_OPENAI_ENDPOINT;
    deployment = ctx.Secrets.AZURE_OPENAI_DEPLOYMENT;
  } catch {
    throw new ProviderConfigError('Endpoint or deployment not configured');
  }
  let apiVersion = DEFAULT_API_VERSION;
  try {
    apiVersion = ctx.Secrets.AZURE_OPENAI_API_VERSION;
  } catch {
    // Optional: the default stays.
  }
  return { endpoint, deployment, apiVersion };
}

udf.func(
  'chatTurn',
  async (ctx: RayfinContext<Record<string, never>, AudienceType.AzureAI>, turn: ChatTurnInput): Promise<ChatTurnOutput> =>
    runChatTurn(turn, {
      token: () => ctx.Tokens.AzureAI,
      config: () => providerConfig(ctx),
      fetchImpl: fetch,
      now: () => Date.now(),
    }),
  []
);
