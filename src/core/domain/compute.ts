import { computePortfolioVsVtiCore } from './computeShared';
import type { ComputedSeries, PriceSeries, TradeEvent } from './types';

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
  return computePortfolioVsVtiCore({ events, priceSeriesByTicker, maxBackTradingDays, anchorTicker });
}

