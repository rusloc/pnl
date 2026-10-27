// Azure OpenAI chat completions over plain `fetch` with the Entra bearer the
// Rayfin host mints for `AudienceType.AzureAI` (no API key exists on the
// resource, ADR-0009 §8.2). This is the only module of the package that calls
// `fetch`, and the only URL it builds derives from the configured endpoint and
// deployment: `scripts/guard-chat-function.mjs` fails the build otherwise.
// REST reference: POST {endpoint}/openai/deployments/{deployment}/chat/completions?api-version=…

export interface ProviderConfig {
  /** `https://<resource>.openai.azure.com` (or the Foundry project endpoint); no path, no query. */
  endpoint: string;
  /** The deployment name of the model (e.g. a gpt-4.1-mini Data Zone Standard deployment). */
  deployment: string;
  /** Chat-completions API version, e.g. 2024-10-21. */
  apiVersion: string;
}

export class ProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderConfigError';
  }
}

const DEPLOYMENT_NAME = /^[A-Za-z0-9._-]{1,64}$/;
const API_VERSION = /^\d{4}-\d{2}-\d{2}(-preview)?$/;

/** The one URL this package may fetch; every part is validated before it is joined. */
export function chatCompletionsUrl(config: ProviderConfig): string {
  let endpoint: URL;
  try {
    endpoint = new URL(config.endpoint);
  } catch {
    throw new ProviderConfigError('Endpoint is not a URL');
  }
  if (endpoint.protocol !== 'https:' || endpoint.search !== '' || endpoint.hash !== '' || endpoint.username !== '' || endpoint.password !== '') {
    throw new ProviderConfigError('Endpoint must be a plain https URL');
  }
  if (!DEPLOYMENT_NAME.test(config.deployment)) throw new ProviderConfigError('Deployment name is not valid');
  if (!API_VERSION.test(config.apiVersion)) throw new ProviderConfigError('API version is not valid');
  const base = endpoint.toString().replace(/\/+$/, '');
  return `${base}/openai/deployments/${encodeURIComponent(config.deployment)}/chat/completions?api-version=${config.apiVersion}`;
}

// --- Request / response shapes (the subset this app uses) ------------------

export interface ProviderToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export type ProviderMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ProviderToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export interface ProviderRequest {
  messages: ProviderMessage[];
  tools: { type: 'function'; function: { name: string; description: string; parameters: unknown } }[];
  tool_choice: 'auto';
  max_tokens: number;
  temperature: number;
}

export interface ProviderChoice {
  finish_reason: string | null;
  message: { role: string; content: string | null; tool_calls?: ProviderToolCall[] };
}

export type ProviderResult =
  | { ok: true; status: number; choice: ProviderChoice }
  | { ok: false; reason: 'auth' | 'provider' | 'timeout'; status: number | null };

export interface ProviderCallOptions {
  url: string;
  token: string;
  request: ProviderRequest;
  timeoutMs: number;
  fetchImpl: typeof fetch;
}

/** One chat-completions call; the body is never logged or returned, only mapped. */
export async function chatCompletion({ url, token, request, timeoutMs, fetchImpl }: ProviderCallOptions): Promise<ProviderResult> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(request),
      signal: abort.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, reason: abort.signal.aborted ? 'timeout' : 'provider', status: null };
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 401 || response.status === 403) return { ok: false, reason: 'auth', status: response.status };
  if (!response.ok) return { ok: false, reason: 'provider', status: response.status };
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, reason: 'provider', status: response.status };
  }
  const choice = firstChoice(body);
  if (choice === null) return { ok: false, reason: 'provider', status: response.status };
  return { ok: true, status: response.status, choice };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `choices[0]` with its shape checked field by field; anything else is a provider error. */
export function firstChoice(body: unknown): ProviderChoice | null {
  if (!isRecord(body) || !Array.isArray(body.choices) || body.choices.length === 0) return null;
  const choice = body.choices[0];
  if (!isRecord(choice) || !isRecord(choice.message)) return null;
  const message = choice.message;
  const content = typeof message.content === 'string' ? message.content : null;
  const role = typeof message.role === 'string' ? message.role : 'assistant';
  const finish = typeof choice.finish_reason === 'string' ? choice.finish_reason : null;
  const calls: ProviderToolCall[] = [];
  if (Array.isArray(message.tool_calls)) {
    for (const call of message.tool_calls) {
      if (!isRecord(call) || !isRecord(call.function)) continue;
      const id = call.id;
      const name = call.function.name;
      const args = call.function.arguments;
      if (typeof id !== 'string' || typeof name !== 'string' || typeof args !== 'string') continue;
      calls.push({ id, type: 'function', function: { name, arguments: args } });
    }
  }
  return { finish_reason: finish, message: calls.length > 0 ? { role, content, tool_calls: calls } : { role, content } };
}
