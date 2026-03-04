import { specError } from '../utils/errors';

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

const INVALID_PLACEHOLDER = '—';

export function formatNumber(n: unknown): string {
    if (typeof n !== 'number' || !Number.isFinite(n)) return INVALID_PLACEHOLDER;
    return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function formatPercent(n: unknown): string {
    if (typeof n !== 'number' || !Number.isFinite(n)) return INVALID_PLACEHOLDER;
    const sign = n > 0 ? '+' : '';
    return `${sign}${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

export function pad2(n: number): string {
    return String(n).padStart(2, '0');
  }