import { specError } from './errors';

export function parseNumberStrict(raw: string, ctx?: Record<string, unknown>): number {
  const s = raw.replace(/\s+/g, '').replace(/,/g, '');
  if (s === '' || s === '--') {
    throw specError('PARSE_NUMBER_EMPTY', `Invalid number: "${raw}"`, { raw, ...ctx });
  }
  const n = Number(s);
  if (!Number.isFinite(n)) {
    throw specError('PARSE_NUMBER_NAN', `Invalid number: "${raw}"`, { raw, ...ctx });
  }
  return n;
}

