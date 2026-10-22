// RFC 4180 CSV reader for the dummy dataset (ADR-0002 §2.2): quoted fields may hold commas, quotes ("") and line
// breaks — dim_account.csv relies on it. Yields one string[] per record; CRLF and LF both end a record.

const QUOTE = 34;
const COMMA = 44;
const LF = 10;
const CR = 13;

export function* csvRecords(text: string): Generator<string[]> {
  const n = text.length;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  while (i < n) {
    const record: string[] = [];
    for (;;) {
      if (text.charCodeAt(i) === QUOTE) {
        let field = '';
        i++;
        for (;;) {
          const q = text.indexOf('"', i);
          if (q < 0) throw new Error(`CSV: unterminated quoted field at offset ${i}`);
          field += text.slice(i, q);
          i = q + 1;
          if (text.charCodeAt(i) !== QUOTE) break;
          field += '"';
          i++;
        }
        record.push(field);
      } else {
        let j = i;
        for (; j < n; j++) {
          const c = text.charCodeAt(j);
          if (c === COMMA || c === LF || c === CR) break;
          if (c === QUOTE) throw new Error(`CSV: quote inside unquoted field at offset ${j}`);
        }
        record.push(text.slice(i, j));
        i = j;
      }
      const c = text.charCodeAt(i);
      if (c === COMMA) {
        i++;
        continue;
      }
      if (c === CR) i++;
      if (text.charCodeAt(i) === LF) i++;
      else if (i < n && c !== CR) throw new Error(`CSV: unexpected character after quoted field at offset ${i}`);
      break;
    }
    yield record;
  }
}

/** Reads a CSV with a header row; throws unless the header equals `columns` exactly (order included). */
export function* csvTable(text: string, columns: readonly string[], file: string): Generator<string[]> {
  const records = csvRecords(text);
  const header = records.next();
  if (header.done || header.value.join(',') !== columns.join(','))
    throw new Error(`${file}: header ${header.done ? '(missing)' : header.value.join(',')} ≠ ${columns.join(',')}`);
  let line = 1;
  for (const record of records) {
    line++;
    if (record.length !== columns.length)
      throw new Error(`${file}:${line}: ${record.length} fields, expected ${columns.length}`);
    yield record;
  }
}
