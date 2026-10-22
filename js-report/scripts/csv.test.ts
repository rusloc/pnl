import { describe, expect, it } from 'vitest';
import { csvRecords, csvTable } from './csv.ts';

const all = (text: string) => [...csvRecords(text)];

describe('csvRecords (RFC 4180)', () => {
  it('splits plain records, LF and CRLF, with or without a final newline', () => {
    expect(all('a,b\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(all('a,b\r\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('keeps commas, escaped quotes and line breaks inside quoted fields (dim_account.csv shape)', () => {
    expect(all('x,"Units shipped × list price, before deductions.",y\n')).toEqual([
      ['x', 'Units shipped × list price, before deductions.', 'y'],
    ]);
    expect(all('"say ""hi""","a\nb"\n')).toEqual([['say "hi"', 'a\nb']]);
  });

  it('keeps empty fields, which mean null in the dataset', () => {
    expect(all('a,,c\n,\n')).toEqual([
      ['a', '', 'c'],
      ['', ''],
    ]);
  });

  it('strips a UTF-8 BOM', () => {
    expect(all('﻿a,b\n')).toEqual([['a', 'b']]);
  });

  it('rejects malformed quoting', () => {
    expect(() => all('"open\n')).toThrow(/unterminated/);
    expect(() => all('"a"b,c\n')).toThrow(/after quoted field/);
    expect(() => all('a"b,c\n')).toThrow(/quote inside/);
  });
});

describe('csvTable', () => {
  it('checks the header and the field count of every record', () => {
    expect([...csvTable('a,b\n1,2\n', ['a', 'b'], 't.csv')]).toEqual([['1', '2']]);
    expect(() => [...csvTable('a,c\n1,2\n', ['a', 'b'], 't.csv')]).toThrow(/header/);
    expect(() => [...csvTable('a,b\n1\n', ['a', 'b'], 't.csv')]).toThrow(/t\.csv:2: 1 fields/);
  });
});
