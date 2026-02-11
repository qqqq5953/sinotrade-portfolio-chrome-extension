import { isoDateToUtcTsMs } from './date';
import { specError } from './errors';
import { getPriceAtOrBefore, resolveDateByAnchorPrice } from './prices';
import type { ComputedSeries, Holdings, PriceSeries, TradeEvent, TradeType } from './types';

function typeOrder(t: TradeType): number {
  return t === 'BUY' ? 0 : 1;
}

function addHolding(holdings: Holdings, ticker: string, delta: number): void {
  const cur = holdings.get(ticker) ?? 0;
  const next = cur + delta;
  if (Math.abs(next) < 1e-12) {
    holdings.delete(ticker);
  } else {
    holdings.set(ticker, next);
  }
}

function assertNonNegativeHolding(holdings: Holdings, ticker: string, ctx: Record<string, unknown>): void {
  const cur = holdings.get(ticker) ?? 0;
  if (cur < -1e-12) {
    throw specError('NEGATIVE_HOLDING', `Negative holding for ${ticker}`, { ...ctx, ticker, holding: cur });
  }
}

export interface ComputeInputs {
  events: TradeEvent[];
  /** priceSeriesByTicker must include "VTI" */
  priceSeriesByTicker: Map<string, PriceSeries>;
  /** Maximum lookback for missing price after resolving date */
  maxBackTradingDays?: number; // default 7
  /** When resolving event date, use VTI as anchor */
  anchorTicker?: string; // default "VTI"
}

export function computePortfolioVsVtiSeries(inputs: ComputeInputs): ComputedSeries {
  console.log('========= computePortfolioVsVtiSeries =========');
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

  console.log('dayKeys', dayKeys);
  
  for (const dayKey of dayKeys) {
    const dayEvents = byDay.get(dayKey) ?? [];
    // Resolve day using anchor (VTI) series first (timezone alignment).
    const { resolvedIsoDateET } = resolveDateByAnchorPrice(anchorSeries, dayKey);
    const ctxBase = { dayKey, resolvedIsoDateET };

    // Sort for deterministic processing; BUY before SELL (AI_SPEC #10.4)
    dayEvents.sort((a, b) => typeOrder(a.type) - typeOrder(b.type));

    // Apply to portfolio holdings
    for (const ev of dayEvents) {
      addHolding(holdings, ev.ticker, ev.type === 'BUY' ? ev.shares : -ev.shares);
      assertNonNegativeHolding(holdings, ev.ticker, { ...ctxBase, event: ev });
    }

    // Portfolio value at resolved date
    let portfolioValue = 0;
    for (const [ticker, shares] of holdings) {
        console.log('ticker', ticker);
        const ps = priceSeriesByTicker.get(ticker);
        if (!ps) throw specError('MISSING_PRICE_SERIES', `Missing price series: ${ticker}`, { ...ctxBase, ticker });
        const { price } = getPriceAtOrBefore(ps, resolvedIsoDateET, { maxBackTradingDays });
        portfolioValue += shares * price;
    }

    // VTI updates at resolved date using *cash* (AI_SPEC #10)
    const vtiPrice = getPriceAtOrBefore(anchorSeries, resolvedIsoDateET, { maxBackTradingDays }).price;
    for (const ev of dayEvents) {
      const deltaShares = ev.cash / vtiPrice;
      vtiShares += ev.type === 'BUY' ? deltaShares : -deltaShares;
      if (vtiShares < -1e-12) {
        throw specError('NEGATIVE_VTI', 'VTI shares would become negative', { ...ctxBase, vtiShares, event: ev });
      }
    }
    const vtiValue = vtiShares * vtiPrice;

    const tsMs = isoDateToUtcTsMs(resolvedIsoDateET);
    resolvedIsoDatesET.push(resolvedIsoDateET);
    portfolio.push({ tsMs, value: portfolioValue });
    vti.push({ tsMs, value: vtiValue });
  }

  return { resolvedIsoDatesET, portfolio, vti };
}

