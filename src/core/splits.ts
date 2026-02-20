import type { TradeEvent } from './types';
import type { YahooSplitEvent } from './yahoo';

/**
 * Normalize BUY shares to current share basis by applying split factors that
 * happened strictly after each trade date.
 *
 * Rule:
 * - Apply split when split.isoDateET > event.isoDateET (strictly greater).
 * - Same-day split is NOT applied to avoid intraday ordering ambiguity.
 */
export function normalizeBuyEventsBySplits(
  events: TradeEvent[],
  splitsByTicker: Map<string, YahooSplitEvent[]>
): TradeEvent[] {
  return events.map((e) => {
    if (e.type !== 'BUY') return e;
    const splits = splitsByTicker.get(e.ticker) ?? [];
    if (splits.length === 0) return e;

    const appliedSplits = splits.filter((s) => s.isoDateET > e.isoDateET);
    const factor = appliedSplits.reduce((acc, s) => acc * s.factor, 1);
    if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return e;

    const chain = appliedSplits.map((s) => `${s.isoDateET} x${String(s.factor)}`);
    return {
      ...e,
      splitAdjustedFromShares: e.shares,
      splitFactorApplied: factor,
      splitAppliedChain: chain,
      shares: e.shares * factor
    };
  });
}

