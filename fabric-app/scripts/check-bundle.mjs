// Regression gate: every built script must be parseable JavaScript, otherwise
// the deployed app is a blank page. Mirrors the check `rayfin up` runs just
// before packaging (`node --input-type=module --check` on each file), so the
// failure surfaces locally, in `npm run build`, instead of after the build on
// the deploy. Usage: node scripts/check-bundle.mjs [dir] (default
// packages/frontend/dist).
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? 'packages/frontend/dist');
const SCRIPT_EXTENSIONS = new Set(['.js', '.mjs']);

function parseFailure(source, goal) {
  const result = spawnSync(process.execPath, [`--input-type=${goal}`, '--check'], {
    input: source,
    encoding: 'utf8',
    maxBuffer: Buffer.byteLength(source, 'utf8') * 2 + 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status === 0) return null;
  // Node echoes the offending source line first; keep only the diagnostic.
  const line = result.stderr.split('\n').find((l) => /^\w*Error\b/.test(l.trim()));
  return (line ?? result.stderr).trim().slice(0, 300);
}

function* scripts(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* scripts(full);
    else if (SCRIPT_EXTENSIONS.has(extname(entry).toLowerCase())) yield full;
  }
}

let checked = 0;
const failures = [];
try {
  for (const file of scripts(root)) {
    checked += 1;
    const source = readFileSync(file, 'utf8');
    const asModule = parseFailure(source, 'module');
    if (asModule === null || parseFailure(source, 'commonjs') === null) continue;
    failures.push(`${relative(root, file)}: ${asModule}`);
  }
} catch (err) {
  console.error(`check-bundle: cannot read ${root}: ${err instanceof Error ? err.message : err}`);
  process.exit(2);
}

if (checked === 0) {
  console.error(`check-bundle: no scripts found under ${root} — build first.`);
  process.exit(2);
}
if (failures.length > 0) {
  console.error(`check-bundle: ${failures.length} unparseable script(s) under ${root}:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`check-bundle: ${checked} script(s) under ${relative(process.cwd(), root) || '.'} parse as JavaScript.`);
