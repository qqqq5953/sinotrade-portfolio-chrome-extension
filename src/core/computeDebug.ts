import { computePortfolioVsVtiCore, type CoreDayTrace } from './computeShared';
import type { PriceSeries, TradeEvent, TradeType } from './types';


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
  splitAdjustedFromShares?: number;
  splitFactorApplied?: number;
  splitAppliedChain?: string[];
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
  /** Sum of cash amounts for events on this day */
  dayCashTotal: number;
  /** Sum of VTI delta shares computed from cash for events on this day */
  vtiDeltaSharesTotal: number;
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
  console.log('========= computePortfolioVsVtiSeriesWithDebug =========');
  const { events, priceSeriesByTicker } = inputs;
  console.log('events', events);
  console.log('priceSeriesByTicker', priceSeriesByTicker);
  const maxBackTradingDays = inputs.maxBackTradingDays ?? 7;
  const anchorTicker = inputs.anchorTicker ?? 'VTI';

  const debugRows: DebugDayRow[] = [];

  const series = computePortfolioVsVtiCore(
    { events, priceSeriesByTicker, maxBackTradingDays, anchorTicker },
    {
      onDayComputed: (t: CoreDayTrace) => {
        const vtiPriceUsed: DebugPriceUsed = {
          ticker: anchorTicker,
          requestedIsoDateET: t.resolvedIsoDateET,
          usedIsoDateET: t.vtiPriceUsed.usedIsoDateET,
          backfilled: t.vtiPriceUsed.backfilled,
          price: t.vtiPriceUsed.price
        };

        const debugEvents: DebugEventUsed[] = t.eventTraces.map((et) => ({
          type: et.event.type,
          ticker: et.event.ticker,
          shares: et.event.shares,
          ...(et.event.splitAdjustedFromShares != null
            ? { splitAdjustedFromShares: et.event.splitAdjustedFromShares }
            : {}),
          ...(et.event.splitFactorApplied != null
            ? { splitFactorApplied: et.event.splitFactorApplied }
            : {}),
          ...(Array.isArray(et.event.splitAppliedChain) && et.event.splitAppliedChain.length > 0
            ? { splitAppliedChain: et.event.splitAppliedChain }
            : {}),
          cash: et.event.cash,
          isoDateET: et.event.isoDateET,
          resolvedIsoDateET: et.resolvedIsoDateET,
          vtiPrice: et.vtiPrice,
          vtiDeltaShares: et.vtiDeltaShares,
          vtiSharesAfter: et.vtiSharesAfter
        }));

        const portfolioPricesUsed: DebugPriceUsed[] = t.portfolioPricesUsed;

        debugRows.push({
          dayKeyIsoDateET: t.dayKeyIsoDateET,
          resolvedIsoDateET: t.resolvedIsoDateET,
          anchorShifted: t.anchorShifted,
          events: debugEvents,
          holdingsAfter: t.holdingsAfter,
          portfolioPricesUsed,
          vtiPriceUsed,
          dayCashTotal: t.dayCashTotal,
          vtiDeltaSharesTotal: t.vtiDeltaSharesTotal,
          portfolioValue: t.portfolioValue,
          vtiShares: t.vtiShares,
          vtiValue: t.vtiValue,
          tsMs: t.tsMs
        });
      }
    }
  );

  return { ...series, debugRows };
}

