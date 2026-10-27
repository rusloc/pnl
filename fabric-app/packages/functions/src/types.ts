/**
 * Function schema types for RayfinClient.
 *
 * AUTO-GENERATED — do not edit manually.
 * Re-generated automatically when function source files change.
 *
 * If this file is not updating automatically, run:
 *   rayfin dev functions apply
 *
 * The schema is a closed object type: only the function names listed
 * below are accepted by RayfinClient.functions.<name>.invoke(...).
 * Adding, renaming, or changing the signature of a udf.func() call
 * regenerates this file and surfaces type errors at every consumer.
 *
 * IMPORTANT: This file must NOT import any Node.js packages — it is
 * resolved by the frontend app's TypeScript compiler.
 */

export type AppFunctionsSchema = {
  chatTurn: {
    input: { turn: { messages: { role: 'user' | 'assistant' | 'tool'; content: string; toolCallId: null | string; toolCalls: null | { id: string; name: 'get_statement' | 'get_kpis' | 'get_bridge' | 'get_largest_variances' | 'get_profitability' | 'get_context' | 'explain_line' | 'explain_kpi'; argumentsJson: string }[] }[] } };
    output: { kind: 'answer'; text: string } | { kind: 'tool_calls'; calls: { id: string; name: 'get_statement' | 'get_kpis' | 'get_bridge' | 'get_largest_variances' | 'get_profitability' | 'get_context' | 'explain_line' | 'explain_kpi'; argumentsJson: string }[] } | { kind: 'error'; reason: 'not_configured' | 'bad_request' | 'auth' | 'provider' | 'timeout' | 'filtered'; status: null | number };
  };
};
