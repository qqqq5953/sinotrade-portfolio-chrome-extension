import { isoDateToUtcTsMs } from './date';
import { specError } from './errors';
import { getPriceAtOrBefore, resolveDateByAnchorPrice } from './prices';
import type { Holdings, PriceSeries, TradeEvent, TradeType } from './types';

/**
 * Core computation shared by:
 * - `compute.ts` (minimal output for chart / tests)
 * - `computeDebug.ts` (same math, plus debug table rows)
 *
 * This file exists to prevent logic drift: the compute order, date resolution,
 * backfill rules, and error conditions MUST stay identical between "normal" and
 * "debug" modes.
 *
 * High-level algorithm (trade-day points):
 * - Sort events by `isoDateET`, group into day buckets.
 * - For each day bucket:
 *   - Resolve the day's ET date key via anchor ticker (default: VTI) to handle
 *     ET alignment edge cases (see `resolveDateByAnchorPrice`).
 *   - Apply events to portfolio holdings (BUY adds shares, SELL subtracts).
 *   - Use anchor price at the resolved date to convert each event's `cash`
 *     into synthetic VTI share deltas; accumulate into `vtiShares`.
 *   - Value portfolio holdings using each ticker's price series (with "at-or-before"
 *     backfill to avoid look-ahead bias).
 *   - Value VTI using the same anchor price.
 *
 * Debug mode injects a tracer callback that receives a full per-day trace. The
 * tracer must be observational only (no mutation of core state).
 */
export function typeOrder(t: TradeType): number {
  return t === 'BUY' ? 0 : 1;
}

export function addHolding(holdings: Holdings, ticker: string, delta: number): void {
  const cur = holdings.get(ticker) ?? 0;
  const next = cur + delta;
  if (Math.abs(next) < 1e-12) holdings.delete(ticker);
  else holdings.set(ticker, next);
}

export function assertNonNegativeHolding(holdings: Holdings, ticker: string, ctx: Record<string, unknown>): void {
  const cur = holdings.get(ticker) ?? 0;
  if (cur < -1e-12) {
    throw specError('NEGATIVE_HOLDING', `Negative holding for ${ticker}`, { ...ctx, ticker, holding: cur });
  }
}

export interface CoreComputeInputs {
  events: TradeEvent[];
  /** priceSeriesByTicker must include anchorTicker (default "VTI") */
  priceSeriesByTicker: Map<string, PriceSeries>;
  maxBackTradingDays: number;
  anchorTicker: string;
}

export type CoreSeriesOutputs = {
  resolvedIsoDatesET: string[];
  portfolio: { tsMs: number; value: number }[];
  vti: { tsMs: number; value: number }[];
};

export type CorePriceUsed = {
  ticker: string;
  requestedIsoDateET: string;
  usedIsoDateET: string;
  backfilled: boolean;
  price: number;
};

export type CoreEventTrace = {
  event: TradeEvent;
  resolvedIsoDateET: string;
  vtiPrice: number;
  vtiDeltaShares: number;
  vtiSharesAfter: number;
};

export type CoreDayTrace = {
  dayKeyIsoDateET: string;
  resolvedIsoDateET: string;
  anchorShifted: boolean;
  dayCashTotal: number;
  vtiDeltaSharesTotal: number;
  vtiShares: number;
  vtiValue: number;
  portfolioValue: number;
  tsMs: number;
  vtiPriceUsed: CorePriceUsed;
  eventTraces: CoreEventTrace[];
  holdingsAfter: { ticker: string; shares: number }[];
  portfolioPricesUsed: CorePriceUsed[];
};

export interface ComputeTracer {
    onDayComputed?: (trace: CoreDayTrace) => void;
  }

/**
 * Shared core loop:
 * sort -> group by day -> resolve anchor -> apply holdings -> price lookup -> compute values.
 *
 * `compute.ts` uses it without tracer; `computeDebug.ts` injects tracer to build debug rows.
 */
export function computePortfolioVsVtiCore(inputs: CoreComputeInputs, tracer?: ComputeTracer): CoreSeriesOutputs {
    const { events, priceSeriesByTicker, maxBackTradingDays, anchorTicker } = inputs;
    // Avoid doing any allocation for debug-only structures unless a tracer is present.
    const wantTrace = typeof tracer?.onDayComputed === 'function';
  
    const anchorSeries = priceSeriesByTicker.get(anchorTicker);
    if (!anchorSeries) throw specError('MISSING_ANCHOR', `Missing anchor price series: ${anchorTicker}`);
  
    const { dayKeys, byDay } = groupEventsByIsoDay(events);
  
    const holdings: Holdings = new Map();
    let vtiShares = 0;
  
    const resolvedIsoDatesET: string[] = [];
    const portfolio: { tsMs: number; value: number }[] = [];
    const vti: { tsMs: number; value: number }[] = [];
  
    for (const dayKey of dayKeys) {
        const dayEvents = byDay.get(dayKey) ?? [];
        // 2) Resolve ET date key via anchor price existence.
        // This handles "the date shown on the site" vs "Yahoo's ET day bucket"
        // mismatches by shifting to prev/next trading day when needed.

        const { resolvedIsoDateET, shifted } = resolveDateByAnchorPrice(anchorSeries, dayKey);
        const ctxBase = { dayKey, resolvedIsoDateET };

        // Deterministic same-day ordering: BUY before SELL.
        dayEvents.sort((a, b) => typeOrder(a.type) - typeOrder(b.type));
        applyDayEventsToHoldings({ holdings, dayEvents, ctxBase });

        const anchor = lookupAnchorPrice({
            anchorSeries,
            resolvedIsoDateET,
            maxBackTradingDays,
            anchorTicker,
            wantTrace
        });

        const vtiUpdate = updateVtiSharesFromCashflows({
            dayEvents,
            resolvedIsoDateET,
            vtiPrice: anchor.price,
            vtiSharesBefore: vtiShares,
            ctxBase,
            wantTrace
        });
        vtiShares = vtiUpdate.vtiSharesAfter;

        const port = valuePortfolioHoldings({
            holdings,
            priceSeriesByTicker,
            resolvedIsoDateET,
            maxBackTradingDays,
            ctxBase,
            wantTrace
        });

        const vtiValue = vtiShares * anchor.price;
        const tsMs = isoDateToUtcTsMs(resolvedIsoDateET);

        resolvedIsoDatesET.push(resolvedIsoDateET);
        portfolio.push({ tsMs, value: port.portfolioValue });
        vti.push({ tsMs, value: vtiValue });

        // Optional debug tracing (observability only).
        emitTraceIfWanted({
            wantTrace,
            tracer,
            dayKeyIsoDateET: dayKey,
            resolvedIsoDateET,
            shifted,
            dayCashTotal: vtiUpdate.dayCashTotal,
            vtiDeltaSharesTotal: vtiUpdate.vtiDeltaSharesTotal,
            vtiShares,
            vtiValue,
            portfolioValue: port.portfolioValue,
            tsMs,
            vtiPriceUsed: anchor.used,
            eventTraces: vtiUpdate.eventTraces,
            holdingsAfter: port.holdingsAfter,
            portfolioPricesUsed: port.portfolioPricesUsed
        });
    }

    return { resolvedIsoDatesET, portfolio, vti };
}

type GroupedByDay = {
  dayKeys: string[];
  byDay: Map<string, TradeEvent[]>;
};

function groupEventsByIsoDay(events: TradeEvent[]): GroupedByDay {
  // Deterministic ordering: event stream -> sorted by day -> day buckets.
  const sorted = [...events].sort((a, b) => a.isoDateET.localeCompare(b.isoDateET));
  const byDay = new Map<string, TradeEvent[]>();
  for (const e of sorted) {
    const arr = byDay.get(e.isoDateET);
    if (arr) arr.push(e);
    else byDay.set(e.isoDateET, [e]);
  }
  const dayKeys = [...byDay.keys()].sort((a, b) => a.localeCompare(b));
  return { dayKeys, byDay };
}

function applyDayEventsToHoldings(args: {
  holdings: Holdings;
  dayEvents: TradeEvent[];
  ctxBase: Record<string, unknown>;
}): void {
  // Apply events to portfolio holdings snapshot (post-trade holdings).
  for (const ev of args.dayEvents) {
    addHolding(args.holdings, ev.ticker, ev.type === 'BUY' ? ev.shares : -ev.shares);
    assertNonNegativeHolding(args.holdings, ev.ticker, { ...args.ctxBase, event: ev });
  }
}

function lookupAnchorPrice(args: {
  anchorSeries: PriceSeries;
  resolvedIsoDateET: string;
  maxBackTradingDays: number;
  anchorTicker: string;
  wantTrace: boolean;
}): { price: number; used: CorePriceUsed | null; usedIsoDateET: string; backfilled: boolean } {
  // Anchor price lookup at the resolved date (with backward-only backfill).
  const vtiLookup = getPriceAtOrBefore(args.anchorSeries, args.resolvedIsoDateET, { maxBackTradingDays: args.maxBackTradingDays }, args.anchorTicker);
  const used = args.wantTrace
    ? ({
        ticker: args.anchorTicker,
        requestedIsoDateET: args.resolvedIsoDateET,
        usedIsoDateET: vtiLookup.isoDateET,
        backfilled: vtiLookup.backfilled,
        price: vtiLookup.price
      } satisfies CorePriceUsed)
    : null;
  return { price: vtiLookup.price, used, usedIsoDateET: vtiLookup.isoDateET, backfilled: vtiLookup.backfilled };
}

function updateVtiSharesFromCashflows(args: {
  dayEvents: TradeEvent[];
  resolvedIsoDateET: string;
  vtiPrice: number;
  vtiSharesBefore: number;
  ctxBase: Record<string, unknown>;
  wantTrace: boolean;
}): {
  vtiSharesAfter: number;
  dayCashTotal: number;
  vtiDeltaSharesTotal: number;
  eventTraces: CoreEventTrace[];
} {
  let vtiShares = args.vtiSharesBefore;
  let dayCashTotal = 0;
  let vtiDeltaSharesTotal = 0;
  const eventTraces: CoreEventTrace[] = [];

  for (const ev of args.dayEvents) {
    dayCashTotal += ev.cash;
    const deltaShares = ev.cash / args.vtiPrice;
    vtiDeltaSharesTotal += deltaShares;
    vtiShares += ev.type === 'BUY' ? deltaShares : -deltaShares;
    if (vtiShares < -1e-12) {
      throw specError('NEGATIVE_VTI', 'VTI shares would become negative', { ...args.ctxBase, vtiShares, event: ev });
    }
    if (args.wantTrace) {
      eventTraces.push({
        event: ev,
        resolvedIsoDateET: args.resolvedIsoDateET,
        vtiPrice: args.vtiPrice,
        vtiDeltaShares: deltaShares,
        vtiSharesAfter: vtiShares
      });
    }
  }

  return { vtiSharesAfter: vtiShares, dayCashTotal, vtiDeltaSharesTotal, eventTraces };
}

function valuePortfolioHoldings(args: {
  holdings: Holdings;
  priceSeriesByTicker: Map<string, PriceSeries>;
  resolvedIsoDateET: string;
  maxBackTradingDays: number;
  ctxBase: Record<string, unknown>;
  wantTrace: boolean;
}): { portfolioValue: number; holdingsAfter: { ticker: string; shares: number }[]; portfolioPricesUsed: CorePriceUsed[] } {
  let portfolioValue = 0;
  const holdingsAfter: { ticker: string; shares: number }[] = [];
  const portfolioPricesUsed: CorePriceUsed[] = [];

  for (const [ticker, shares] of args.holdings) {
    if (args.wantTrace) holdingsAfter.push({ ticker, shares });
    const ps = args.priceSeriesByTicker.get(ticker);
    if (!ps) throw specError('MISSING_PRICE_SERIES', `Missing price series: ${ticker}`, { ...args.ctxBase, ticker });
    const lookup = getPriceAtOrBefore(ps, args.resolvedIsoDateET, { maxBackTradingDays: args.maxBackTradingDays }, ticker);
    if (args.wantTrace) {
      portfolioPricesUsed.push({
        ticker,
        requestedIsoDateET: args.resolvedIsoDateET,
        usedIsoDateET: lookup.isoDateET,
        backfilled: lookup.backfilled,
        price: lookup.price
      });
    }
    portfolioValue += shares * lookup.price;
  }

  return { portfolioValue, holdingsAfter, portfolioPricesUsed };
}

function emitTraceIfWanted(args: {
  wantTrace: boolean;
  tracer: ComputeTracer | undefined;
  dayKeyIsoDateET: string;
  resolvedIsoDateET: string;
  shifted: boolean;
  dayCashTotal: number;
  vtiDeltaSharesTotal: number;
  vtiShares: number;
  vtiValue: number;
  portfolioValue: number;
  tsMs: number;
  vtiPriceUsed: CorePriceUsed | null;
  eventTraces: CoreEventTrace[];
  holdingsAfter: { ticker: string; shares: number }[];
  portfolioPricesUsed: CorePriceUsed[];
}): void {
  if (!args.wantTrace) return;
  args.tracer?.onDayComputed?.({
    dayKeyIsoDateET: args.dayKeyIsoDateET,
    resolvedIsoDateET: args.resolvedIsoDateET,
    anchorShifted: args.shifted,
    dayCashTotal: args.dayCashTotal,
    vtiDeltaSharesTotal: args.vtiDeltaSharesTotal,
    vtiShares: args.vtiShares,
    vtiValue: args.vtiValue,
    portfolioValue: args.portfolioValue,
    tsMs: args.tsMs,
    vtiPriceUsed: args.vtiPriceUsed!,
    eventTraces: args.eventTraces,
    holdingsAfter: args.holdingsAfter,
    portfolioPricesUsed: args.portfolioPricesUsed
  });
}

