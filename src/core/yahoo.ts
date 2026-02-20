import { isoDateToUtcSeconds } from './date';
import { specError } from './errors';
import type { PriceSeries } from './types';

export interface YahooFetchRange {
  /** ISO date, e.g. "2024-01-01" */
  startIsoDateUtc: string;
  /** ISO date, e.g. "2024-12-31" (period2 will be +1 day buffer upstream if desired) */
  endIsoDateUtc: string;
}

export interface YahooParseOptions {
  /** Prefer adjclose for valuation (per AI_SPEC section 10). */
  preferAdjClose: boolean; // default true
}

export interface YahooChartSplit {
  date: number;
  numerator: number;
  denominator: number;
  splitRatio: string;
}

export interface YahooSplitEvent {
  isoDateET: string;
  factor: number;
  date: number;
  splitRatio: string;
}

export interface YahooChartResult {
  meta?: Record<string, unknown>;
  timestamp?: number[];
  events?: {
    splits?: Record<string, YahooChartSplit>;
  };
  indicators?: {
    quote?: Array<{
      close?: number[];
      volume?: number[];
      high?: number[];
      open?: number[];
      low?: number[];
    }>;
    adjclose?: Array<{
      adjclose?: number[];
    }>;
  };
}

export interface YahooChartResponse {
  chart: {
    result: YahooChartResult[] | null;
    error: { code: string; description: string } | null;
  };
}

const DEFAULT_PARSE_OPTS: YahooParseOptions = {
  preferAdjClose: true
};

function formatIsoDateInET(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  // en-CA yields "YYYY-MM-DD"
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', // 這樣「一天」對應的是美東的交易日，和美股收盤日一致，不會因為 UTC 換日而錯到前一天或後一天。
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return fmt.format(d);
}

export async function fetchYahooPriceSeries(
  symbol: string,
  range: YahooFetchRange,
  signal?: AbortSignal
): Promise<YahooChartResponse> {
  const period1 = isoDateToUtcSeconds(range.startIsoDateUtc);
  // period2 is inclusive-ish; caller can pass end+1 for buffer
  const period2 = isoDateToUtcSeconds(range.endIsoDateUtc);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?formatted=true&includeAdjustedClose=true&events=split&interval=1d&period1=${period1}&period2=${period2}`;

  const res = await fetch(url, signal ? { signal } : undefined);
  if (!res.ok) {
    console.log('===not ok===', { symbol, status: res.status, url });
    throw specError('YAHOO_HTTP', `Yahoo HTTP ${res.status}`, { symbol, status: res.status, url });
  }
  return (await res.json()) as YahooChartResponse;
}

export function parseYahooChartToPriceSeries(
  symbol: string,
  yahooJson: YahooChartResponse,
  opts: YahooParseOptions = DEFAULT_PARSE_OPTS
): PriceSeries {
  const chartErr = yahooJson?.chart?.error;
  if (chartErr) {
    console.log('===parseYahooChartToPriceSeries chartErr===', { symbol, chartError: chartErr });
    throw specError('YAHOO_CHART_ERROR', 'Yahoo chart.error', { symbol, chartError: chartErr });
  }
  const result = yahooJson?.chart?.result?.[0];
  if (!result) {
    throw specError('YAHOO_PARSE', 'Missing chart.result[0]', { symbol });
  }

  const timestamps: number[] | undefined = result.timestamp;
  const closes: number[] | undefined = result?.indicators?.quote?.[0]?.close;
  const adjcloses: number[] | undefined = result?.indicators?.adjclose?.[0]?.adjclose;

  if (!Array.isArray(timestamps) || !Array.isArray(closes)) {
    throw specError('YAHOO_PARSE', 'Invalid timestamp/close arrays', { symbol });
  }

  const series: PriceSeries = new Map();
  for (let i = 0; i < timestamps.length; i += 1) {
    const ts = timestamps[i];
    if (typeof ts !== 'number') continue;
    const isoDateET = formatIsoDateInET(ts);
    const close = closes[i] ?? null;
    const adj = Array.isArray(adjcloses) ? (adjcloses[i] ?? null) : null;
    const price = opts.preferAdjClose ? (adj ?? close) : (close ?? adj);
    if (typeof price === 'number' && Number.isFinite(price)) {
      series.set(isoDateET, price);
    }
  }

  if (series.size === 0) {
    throw specError('YAHOO_EMPTY', 'Parsed empty price series', { symbol });
  }
  return series;
}

export interface YahooPriceSeriesPair {
  close: PriceSeries;
  adjclose: PriceSeries;
}

export function parseYahooChartSplits(symbol: string, yahooJson: YahooChartResponse): YahooSplitEvent[] {
  const chartErr = yahooJson.chart.error;
  if (chartErr) {
    console.log('===parseYahooChartSplits chartErr===', { symbol, chartError: chartErr });
    throw specError('YAHOO_CHART_ERROR', 'Yahoo chart.error', { symbol, chartError: chartErr });
  }
  const result = yahooJson.chart.result?.[0];
  if (!result) {
    throw specError('YAHOO_PARSE', 'Missing chart.result[0]', { symbol });
  }

  const out: YahooSplitEvent[] = [];
  const splits = result.events?.splits;
  if (!splits) return out;

  for (const s of Object.values(splits)) {
    if (!s) continue;
    if (typeof s.date !== 'number') continue;
    if (typeof s.numerator !== 'number' || typeof s.denominator !== 'number') continue;
    if (!Number.isFinite(s.numerator) || !Number.isFinite(s.denominator) || s.denominator === 0) continue;
    const factor = s.numerator / s.denominator;
    if (!Number.isFinite(factor) || factor <= 0) continue;
    out.push({
      isoDateET: formatIsoDateInET(s.date),
      factor,
      date: s.date,
      splitRatio: s.splitRatio
    });
  }

  out.sort((a, b) => a.date - b.date);
  return out;
}

/**
 * Parse Yahoo chart JSON into two separate series:
 * - close: raw close (no fallback)
 * - adjclose: adjusted close (no fallback)
 *
 * This is useful for fast switching between valuation bases without refetching.
 */
export function parseYahooChartToPriceSeriesPair(symbol: string, yahooJson: YahooChartResponse): YahooPriceSeriesPair {
  const chartErr = yahooJson?.chart?.error;
  if (chartErr) {
    console.log('===parseYahooChartToPriceSeriesPair chartErr===', { symbol, chartError: chartErr });
    throw specError('YAHOO_CHART_ERROR', 'Yahoo chart.error', { symbol, chartError: chartErr });
  }
  const result = yahooJson?.chart?.result?.[0];
  if (!result) {
    throw specError('YAHOO_PARSE', 'Missing chart.result[0]', { symbol });
  }

  const timestamps: number[] | undefined = result.timestamp;
  const closes: number[] | undefined = result?.indicators?.quote?.[0]?.close;
  const adjcloses: number[] | undefined = result?.indicators?.adjclose?.[0]?.adjclose;

  if (!Array.isArray(timestamps) || !Array.isArray(closes)) {
    throw specError('YAHOO_PARSE', 'Invalid timestamp/close arrays', { symbol });
  }

  const closeSeries: PriceSeries = new Map();
  const adjSeries: PriceSeries = new Map();

  for (let i = 0; i < timestamps.length; i += 1) {
    const ts = timestamps[i];
    if (typeof ts !== 'number') continue;
    const isoDateET = formatIsoDateInET(ts);

    const close = closes[i] ?? null;
    if (typeof close === 'number' && Number.isFinite(close)) closeSeries.set(isoDateET, close);

    const adjclose = Array.isArray(adjcloses) ? (adjcloses[i] ?? null) : null;
    if (typeof adjclose === 'number' && Number.isFinite(adjclose)) adjSeries.set(isoDateET, adjclose);
  }

  if (closeSeries.size === 0 && adjSeries.size === 0) {
    throw specError('YAHOO_EMPTY', 'Parsed empty close/adjclose series', { symbol });
  }

  return { close: closeSeries, adjclose: adjSeries };
}

