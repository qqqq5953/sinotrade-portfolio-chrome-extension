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

const DEFAULT_PARSE_OPTS: YahooParseOptions = {
  preferAdjClose: true
};

function formatIsoDateInET(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  // en-CA yields "YYYY-MM-DD"
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
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
): Promise<unknown> {
  const period1 = isoDateToUtcSeconds(range.startIsoDateUtc);
  // period2 is inclusive-ish; caller can pass end+1 for buffer
  const period2 = isoDateToUtcSeconds(range.endIsoDateUtc);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?formatted=true&includeAdjustedClose=true&interval=1d&period1=${period1}&period2=${period2}`;

  const res = await fetch(url, signal ? { signal } : undefined);
  if (!res.ok) {
    console.log('===not ok===', { symbol, status: res.status, url });
    throw specError('YAHOO_HTTP', `Yahoo HTTP ${res.status}`, { symbol, status: res.status, url });
  }
  return (await res.json()) as unknown;
}

export function parseYahooChartToPriceSeries(
  symbol: string,
  yahooJson: any,
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

  const timestamps: unknown[] | undefined = result.timestamp;
  const closes: (number | null)[] | undefined = result?.indicators?.quote?.[0]?.close;
  const adjcloses: (number | null)[] | undefined = result?.indicators?.adjclose?.[0]?.adjclose;

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

/**
 * Parse Yahoo chart JSON into two separate series:
 * - close: raw close (no fallback)
 * - adjclose: adjusted close (no fallback)
 *
 * This is useful for fast switching between valuation bases without refetching.
 */
export function parseYahooChartToPriceSeriesPair(symbol: string, yahooJson: any): YahooPriceSeriesPair {
  const chartErr = yahooJson?.chart?.error;
  if (chartErr) {
    console.log('===parseYahooChartToPriceSeriesPair chartErr===', { symbol, chartError: chartErr });
    throw specError('YAHOO_CHART_ERROR', 'Yahoo chart.error', { symbol, chartError: chartErr });
  }
  const result = yahooJson?.chart?.result?.[0];
  if (!result) {
    throw specError('YAHOO_PARSE', 'Missing chart.result[0]', { symbol });
  }

  const timestamps: unknown[] | undefined = result.timestamp;
  const closes: (number | null)[] | undefined = result?.indicators?.quote?.[0]?.close;
  const adjcloses: (number | null)[] | undefined = result?.indicators?.adjclose?.[0]?.adjclose;

  if (!Array.isArray(timestamps) || !Array.isArray(closes)) {
    throw specError('YAHOO_PARSE', 'Invalid timestamp/close arrays', { symbol });
  }

  const closeSeries: PriceSeries = new Map();
  const adjSeries: PriceSeries = new Map();

  for (let i = 0; i < timestamps.length; i += 1) {
    const ts = timestamps[i];
    if (typeof ts !== 'number') continue;
    const isoDateET = formatIsoDateInET(ts);

    const c = closes[i] ?? null;
    if (typeof c === 'number' && Number.isFinite(c)) closeSeries.set(isoDateET, c);

    const a = Array.isArray(adjcloses) ? (adjcloses[i] ?? null) : null;
    if (typeof a === 'number' && Number.isFinite(a)) adjSeries.set(isoDateET, a);
  }

  if (closeSeries.size === 0 && adjSeries.size === 0) {
    throw specError('YAHOO_EMPTY', 'Parsed empty close/adjclose series', { symbol });
  }

  return { close: closeSeries, adjclose: adjSeries };
}

