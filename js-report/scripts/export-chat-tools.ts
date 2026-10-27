// Writes the Track C chat contract for the relay (system prompt, tool definitions as JSON Schema, limits) to
// .sync/track-c/chat-tools.json (ADR-0009 §4). Reads the built manifest: run `npm run build:data` first. Runs on
// Node's native type stripping, like build-data.ts (erasable TypeScript, explicit `.ts` imports).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chatToolsJson } from '../lib/chat/index.ts';
import { parseManifest } from '../lib/data/manifest.ts';

const manifestPath = fileURLToPath(new URL('../public/data/manifest.json', import.meta.url));
const outPath = fileURLToPath(new URL('../../.sync/track-c/chat-tools.json', import.meta.url));

const json = chatToolsJson(parseManifest(JSON.parse(readFileSync(manifestPath, 'utf8'))));
writeFileSync(outPath, json);
console.log(`chat-tools.json: ${json.length} characters -> ${outPath}`);
