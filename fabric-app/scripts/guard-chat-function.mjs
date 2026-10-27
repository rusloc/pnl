// Guard for the AI chat function (ADR-0009 §2 "Guard"): the build fails if the
// functions package could reach anything but the one LLM endpoint, or could log
// message content. Runs in the validate:functions stage (build, build:fabric,
// typecheck) right after validate-functions.mjs. Rules, over every non-spec
// TypeScript file under packages/functions/src:
//   1. every `RayfinContext<…>` annotation declares `AudienceType.AzureAI` or nothing;
//   2. no `getDataClient`, `getToken`, `getSecret`, and no `Tokens.<X>` other than `Tokens.AzureAI`;
//   3. `fetch` is called only in azure-openai.ts, and only with the URL built by `chatCompletionsUrl`;
//   4. no `http://` / `https://` literal anywhere (the endpoint comes from configuration);
//   5. `console.*` only in safe-log.ts (whose record type carries numbers, never text);
//   6. no `process.env` reads (configuration goes through `ctx.Secrets`);
//   7. no dynamic `import()` or `require` (nothing can smuggle in another transport).
// Usage: node scripts/guard-chat-function.mjs [--root <dir>]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootFlag = process.argv.indexOf('--root');
const root = rootFlag !== -1 && process.argv[rootFlag + 1] !== undefined ? path.resolve(process.argv[rootFlag + 1]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(root, 'packages', 'functions', 'src');
const FETCH_FILE = 'azure-openai.ts';
const LOG_FILE = 'safe-log.ts';
const ALLOWED_AUDIENCE = 'AzureAI';

const require = createRequire(path.join(root, 'package.json'));
const ts = require('typescript');

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.[cm]?ts$/u.test(entry) && !/\.(?:spec|test)\.[cm]?ts$/u.test(entry) && !/\.d\.ts$/u.test(entry)) yield full;
  }
}

const failures = [];
const where = (sf, node) => {
  const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  return `${path.relative(root, sf.fileName).replace(/\\/g, '/')}:${line + 1}`;
};

function audienceNames(typeNode) {
  // `AudienceType.AzureAI | AudienceType.Sql` → ['AzureAI', 'Sql']; a bare `never` → [].
  if (ts.isUnionTypeNode(typeNode)) return typeNode.types.flatMap(audienceNames);
  if (ts.isTypeReferenceNode(typeNode) && ts.isQualifiedName(typeNode.typeName) && typeNode.typeName.left.getText() === 'AudienceType') {
    return [typeNode.typeName.right.text];
  }
  if (typeNode.kind === ts.SyntaxKind.NeverKeyword) return [];
  return [typeNode.getText()];
}

function checkFile(file) {
  const text = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const base = path.basename(file);
  const visit = (node) => {
    // 1. Audiences on RayfinContext annotations.
    if (ts.isTypeReferenceNode(node) && node.typeName.getText() === 'RayfinContext' && node.typeArguments && node.typeArguments.length >= 2) {
      for (const name of audienceNames(node.typeArguments[1])) {
        if (name !== ALLOWED_AUDIENCE) failures.push(`${where(sf, node)}: RayfinContext declares audience "${name}"; only AudienceType.${ALLOWED_AUDIENCE} is allowed.`);
      }
    }
    // 2. Data access and other tokens.
    if (ts.isPropertyAccessExpression(node)) {
      const member = node.name.text;
      if (['getDataClient', 'getToken', 'getSecret'].includes(member)) failures.push(`${where(sf, node)}: "${member}" is not allowed in the chat function.`);
      if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'Tokens' && member !== ALLOWED_AUDIENCE) {
        failures.push(`${where(sf, node)}: Tokens.${member} is not allowed; only Tokens.${ALLOWED_AUDIENCE}.`);
      }
      // 5. Logging.
      if (ts.isIdentifier(node.expression) && node.expression.text === 'console' && base !== LOG_FILE) {
        failures.push(`${where(sf, node)}: console.${member} outside ${LOG_FILE}; log through logEvent() only.`);
      }
      // 6. Environment.
      if (ts.isIdentifier(node.expression) && node.expression.text === 'process' && member === 'env') failures.push(`${where(sf, node)}: process.env is not allowed; read configuration from ctx.Secrets.`);
    }
    // 3. fetch.
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const isFetch = (ts.isIdentifier(callee) && callee.text === 'fetch') || (ts.isPropertyAccessExpression(callee) && callee.name.text === 'fetch');
      if (isFetch) {
        if (base !== FETCH_FILE) failures.push(`${where(sf, node)}: fetch outside ${FETCH_FILE}.`);
        else {
          const url = node.arguments[0];
          if (!url || !ts.isIdentifier(url) || url.text !== 'url') failures.push(`${where(sf, node)}: fetch must be called with the \`url\` built by chatCompletionsUrl.`);
        }
      }
      // 7. Dynamic loading.
      if (callee.kind === ts.SyntaxKind.ImportKeyword) failures.push(`${where(sf, node)}: dynamic import() is not allowed.`);
      if (ts.isIdentifier(callee) && callee.text === 'require') failures.push(`${where(sf, node)}: require() is not allowed.`);
    }
    // 4. URL literals.
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) && /https?:\/\//iu.test(node.text)) {
      failures.push(`${where(sf, node)}: URL literal "${node.text.slice(0, 40)}…"; the endpoint must come from configuration.`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  // Comments may mention URLs (docs); code may not — the AST walk above skips comments by construction.
}

let count = 0;
try {
  statSync(srcRoot);
} catch {
  console.log(JSON.stringify({ ok: true, note: 'packages/functions/src not present; nothing to guard.' }));
  process.exit(0);
}
for (const file of walk(srcRoot)) {
  count += 1;
  checkFile(file);
}
if (count === 0) failures.push('No function source files found under packages/functions/src.');
// The fetch module must exist and the safe-log module too, otherwise the rules above guard nothing.
for (const required of [FETCH_FILE, LOG_FILE]) {
  try {
    statSync(path.join(srcRoot, required));
  } catch {
    failures.push(`packages/functions/src/${required} is missing.`);
  }
}

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, files: count }));
