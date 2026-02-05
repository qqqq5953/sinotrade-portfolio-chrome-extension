import { isoDateToUtcTsMs } from './date';
import { specError } from './errors';
import { getPriceAtOrBefore, resolveDateByAnchorPrice } from './prices';
import type { Holdings, PriceSeries, TradeEvent, TradeType } from './types';

function typeOrder(t: TradeType): number {
  return t === 'BUY' ? 0 : 1;
}

function addHolding(holdings: Holdings, ticker: string, delta: number): void {
  const cur = holdings.get(ticker) ?? 0;
  const next = cur + delta;
  if (Math.abs(next) < 1e-12) holdings.delete(ticker);
  else holdings.set(ticker, next);
}

function assertNonNegativeHolding(holdings: Holdings, ticker: string, ctx: Record<string, unknown>): void {
  const cur = holdings.get(ticker) ?? 0;
  if (cur < -1e-12) {
    throw specError('NEGATIVE_HOLDING', `Negative holding for ${ticker}`, { ...ctx, ticker, holding: cur });
  }
}

export interface DebugPriceUsed {
  ticker: string;
  requestedIsoDateET: string;
  usedIsoDateET: string;
  backfilled: boolean;
  price: number;
}

export interface DebugEventUsed {
  type: TradeType;
  ticker: string;
  shares: number;
  cash: number;
  isoDateET: string;
  resolvedIsoDateET: string;
  vtiPrice: number;
  vtiDeltaShares: number;
  vtiSharesAfter: number;
}

export interface DebugDayRow {
  /** Original ET date key derived from DOM rows (pre anchor resolution) */
  dayKeyIsoDateET: string;
  /** Date key actually used after anchor resolution */
  resolvedIsoDateET: string;
  /** True if anchor resolution shifted the date to prev/next trading day */
  anchorShifted: boolean;
  /** Events processed for this day (after deterministic ordering) */
  events: DebugEventUsed[];
  /** Portfolio holdings snapshot AFTER applying events */
  holdingsAfter: { ticker: string; shares: number }[];
  /** Prices used for valuation (one per holding ticker) */
  portfolioPricesUsed: DebugPriceUsed[];
  /** VTI price used for the day */
  vtiPriceUsed: DebugPriceUsed;
  portfolioValue: number;
  vtiShares: number;
  vtiValue: number;
  tsMs: number;
}

export interface ComputeWithDebugInputs {
  events: TradeEvent[];
  /** priceSeriesByTicker must include "VTI" */
  priceSeriesByTicker: Map<string, PriceSeries>;
  /** Maximum lookback for missing price after resolving date */
  maxBackTradingDays?: number; // default 7
  /** When resolving event date, use VTI as anchor */
  anchorTicker?: string; // default "VTI"
}

export interface ComputedSeriesWithDebug {
  resolvedIsoDatesET: string[];
  portfolio: { tsMs: number; value: number }[];
  vti: { tsMs: number; value: number }[];
  debugRows: DebugDayRow[];
}

export function computePortfolioVsVtiSeriesWithDebug(inputs: ComputeWithDebugInputs): ComputedSeriesWithDebug {
  const { events, priceSeriesByTicker } = inputs;
  const maxBackTradingDays = inputs.maxBackTradingDays ?? 7;
  const anchorTicker = inputs.anchorTicker ?? 'VTI';

  const anchorSeries = priceSeriesByTicker.get(anchorTicker);
  if (!anchorSeries) throw specError('MISSING_ANCHOR', `Missing anchor price series: ${anchorTicker}`);

  const sorted = [...events].sort((a, b) => a.isoDateET.localeCompare(b.isoDateET));
  const byDay = new Map<string, TradeEvent[]>();
  for (const e of sorted) {
    const arr = byDay.get(e.isoDateET);
    if (arr) arr.push(e);
    else byDay.set(e.isoDateET, [e]);
  }
  const dayKeys = [...byDay.keys()].sort((a, b) => a.localeCompare(b));

  const holdings: Holdings = new Map();
  let vtiShares = 0;

  const resolvedIsoDatesET: string[] = [];
  const portfolio: { tsMs: number; value: number }[] = [];
  const vti: { tsMs: number; value: number }[] = [];
  const debugRows: DebugDayRow[] = [];

  for (const dayKey of dayKeys) {
    const dayEvents = (byDay.get(dayKey) ?? []).slice();
    const { resolvedIsoDateET, shifted } = resolveDateByAnchorPrice(anchorSeries, dayKey);
    const ctxBase = { dayKey, resolvedIsoDateET };

    dayEvents.sort((a, b) => typeOrder(a.type) - typeOrder(b.type));

    for (const ev of dayEvents) {
      addHolding(holdings, ev.ticker, ev.type === 'BUY' ? ev.shares : -ev.shares);
      assertNonNegativeHolding(holdings, ev.ticker, { ...ctxBase, event: ev });
    }

    const vtiLookup = getPriceAtOrBefore(anchorSeries, resolvedIsoDateET, { maxBackTradingDays });
    const vtiPriceUsed: DebugPriceUsed = {
      ticker: anchorTicker,
      requestedIsoDateET: resolvedIsoDateET,
      usedIsoDateET: vtiLookup.isoDateET,
      backfilled: vtiLookup.backfilled,
      price: vtiLookup.price
    };

    const debugEvents: DebugEventUsed[] = [];
    for (const ev of dayEvents) {
      const deltaShares = ev.cash / vtiLookup.price;
      vtiShares += ev.type === 'BUY' ? deltaShares : -deltaShares;
      if (vtiShares < -1e-12) {
        throw specError('NEGATIVE_VTI', 'VTI shares would become negative', { ...ctxBase, vtiShares, event: ev });
      }
      debugEvents.push({
        type: ev.type,
        ticker: ev.ticker,
        shares: ev.shares,
        cash: ev.cash,
        isoDateET: ev.isoDateET,
        resolvedIsoDateET,
        vtiPrice: vtiLookup.price,
        vtiDeltaShares: deltaShares,
        vtiSharesAfter: vtiShares
      });
    }

    const portfolioPricesUsed: DebugPriceUsed[] = [];
    let portfolioValue = 0;
    const holdingsAfter: { ticker: string; shares: number }[] = [];
    for (const [ticker, shares] of holdings) {
      holdingsAfter.push({ ticker, shares });
      const ps = priceSeriesByTicker.get(ticker);
      if (!ps) throw specError('MISSING_PRICE_SERIES', `Missing price series: ${ticker}`, { ...ctxBase, ticker });
      const lookup = getPriceAtOrBefore(ps, resolvedIsoDateET, { maxBackTradingDays });
      portfolioPricesUsed.push({
        ticker,
        requestedIsoDateET: resolvedIsoDateET,
        usedIsoDateET: lookup.isoDateET,
        backfilled: lookup.backfilled,
        price: lookup.price
      });
      portfolioValue += shares * lookup.price;
    }

    const vtiValue = vtiShares * vtiLookup.price;
    const tsMs = isoDateToUtcTsMs(resolvedIsoDateET);

    resolvedIsoDatesET.push(resolvedIsoDateET);
    portfolio.push({ tsMs, value: portfolioValue });
    vti.push({ tsMs, value: vtiValue });
    debugRows.push({
      dayKeyIsoDateET: dayKey,
      resolvedIsoDateET,
      anchorShifted: shifted,
      events: debugEvents,
      holdingsAfter,
      portfolioPricesUsed,
      vtiPriceUsed,
      portfolioValue,
      vtiShares,
      vtiValue,
      tsMs
    });
  }

  return { resolvedIsoDatesET, portfolio, vti, debugRows };
}

