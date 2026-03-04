export type TradeType = 'BUY' | 'SELL';

export interface TradeEvent {
  type: TradeType;
  /** As displayed on the page, e.g. "2024/12/30" */
  tradeDate: string;
  /**
   * Initial ISO date key derived from tradeDate (not yet resolved).
   * Must be `YYYY-MM-DD`.
   */
  isoDateET: string;
  ticker: string;
  shares: number;
  /**
   * BUY: 投入成本 (buyCost)
   * SELL: 交割金額 (sellCash)
   */
  cash: number;
  sourceYear: number;
  /**
   * Debug-only metadata: when split normalization is applied, this stores the
   * raw shares before adjustment and the cumulative split factor used.
   */
  splitAdjustedFromShares?: number;
  splitFactorApplied?: number;
  splitAppliedChain?: string[];
}

export type PriceSeries = Map<string, number>; // key: isoDateET

export type Holdings = Map<string, number>; // ticker -> shares

export interface SeriesPoint {
  /** UTC timestamp in milliseconds (for ECharts time axis) */
  tsMs: number;
  value: number;
}

export interface ComputedSeries {
  /** Resolved ET date keys used for each point (same length as points) */
  resolvedIsoDatesET: string[];
  portfolio: SeriesPoint[];
  vti: SeriesPoint[];
}

