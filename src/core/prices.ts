import { specError } from './errors';
import { shiftTradingDayIsoDateET } from './date';
import type { PriceSeries } from './types';

export interface PriceLookupOptions {
  /**
   * After the date has been resolved (timezone alignment), allow looking back
   * for a previous trading day price up to this limit.
   */
  maxBackTradingDays: number; // default 7
}

export const DEFAULT_PRICE_LOOKUP: PriceLookupOptions = {
  maxBackTradingDays: 7
};

export function getPriceAtOrBefore(
  series: PriceSeries,
  isoDateET: string,
  opts: PriceLookupOptions = DEFAULT_PRICE_LOOKUP,
  ticker?: string
): { isoDateET: string; price: number; backfilled: boolean } {
  const direct = series.get(isoDateET);
  if (direct != null) return { isoDateET, price: direct, backfilled: false };

  let cur = isoDateET;
  for (let i = 1; i <= opts.maxBackTradingDays; i += 1) {
    cur = shiftTradingDayIsoDateET(cur, -1);
    const p = series.get(cur);
    if (p != null) return { isoDateET: cur, price: p, backfilled: true };
  }

  console.log('ticker', ticker, 'isoDateET', isoDateET, 'maxBackTradingDays', opts.maxBackTradingDays);
  throw specError('PRICE_MISSING', `Missing price for ${isoDateET}`, {
    isoDateET,
    maxBackTradingDays: opts.maxBackTradingDays
  });
}

export function resolveDateByAnchorPrice(
  anchorSeries: PriceSeries,
  isoDateET: string
): { resolvedIsoDateET: string; shifted: boolean } {
  if (anchorSeries.has(isoDateET)) return { resolvedIsoDateET: isoDateET, shifted: false };

  const prev = shiftTradingDayIsoDateET(isoDateET, -1);
  if (anchorSeries.has(prev)) return { resolvedIsoDateET: prev, shifted: true };

  const next = shiftTradingDayIsoDateET(isoDateET, +1);
  if (anchorSeries.has(next)) return { resolvedIsoDateET: next, shifted: true };

  throw specError('ANCHOR_DATE_UNRESOLVED', `Cannot resolve isoDateET via anchor: ${isoDateET}`, {
    isoDateET,
    tried: [isoDateET, prev, next]
  });
}

