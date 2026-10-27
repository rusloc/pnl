/**
 * Entity map shared by the data registration package and typed browser client.
 *
 * It remains empty while the data service is disabled. Data capabilities add
 * entity keys here so every runtime consumes the same schema contract.
 */
export type UniversalAppSchema = Record<string, never>;

// AI chat (ADR-0009): the closed tool set shared by the `chatTurn` function and the frontend.
export * from './chat-tools.js';
