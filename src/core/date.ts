import { specError } from './errors';

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toIsoDateETFromYmdSlash(tradeDate: string, ctx?: Record<string, unknown>): string {
  const m = tradeDate.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!m) {
    throw specError('PARSE_DATE', `Invalid tradeDate: "${tradeDate}"`, { tradeDate, ...ctx });
  }
  const y = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mm) || !Number.isFinite(dd)) {
    throw specError('PARSE_DATE', `Invalid tradeDate: "${tradeDate}"`, { tradeDate, ...ctx });
  }
  return `${y}-${pad2(mm)}-${pad2(dd)}`;
}

export function isoDateToUtcTsMs(isoDate: string): number {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw specError('ISO_DATE', `Invalid isoDate: "${isoDate}"`, { isoDate });
  const y = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  return Date.UTC(y, mm - 1, dd, 0, 0, 0, 0);
}

export function isoDateToUtcSeconds(isoDate: string): number {
  return Math.floor(isoDateToUtcTsMs(isoDate) / 1000);
}

function addDaysUtc(isoDate: string, deltaDays: number): string {
  const ts = isoDateToUtcTsMs(isoDate);
  const next = new Date(ts + deltaDays * 86400_000);
  const y = next.getUTCFullYear();
  const m = next.getUTCMonth() + 1;
  const d = next.getUTCDate();
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function isWeekendIsoDateET(isoDate: string): boolean {
  const ts = isoDateToUtcTsMs(isoDate);
  const dow = new Date(ts).getUTCDay(); // 0 Sun .. 6 Sat
  return dow === 0 || dow === 6;
}

export function shiftTradingDayIsoDateET(isoDate: string, deltaTradingDays: number): string {
  if (deltaTradingDays === 0) return isoDate;
  const step = deltaTradingDays > 0 ? 1 : -1;
  let remaining = Math.abs(deltaTradingDays);
  let cur = isoDate;
  while (remaining > 0) {
    cur = addDaysUtc(cur, step);
    if (isWeekendIsoDateET(cur)) continue;
    remaining -= 1;
  }
  return cur;
}

