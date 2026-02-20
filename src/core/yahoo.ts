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

