import {
  computePortfolioVsVtiSeriesWithDebug,
  normalizeBuyEventsBySplits,
  parseYahooChartToPriceSeriesPair,
  parseYahooChartSplits,
  type YahooSplitEvent,
  type PriceSeries,
  type TradeEvent
} from '../core';
import { specError } from '../core/errors';
import {
  dedupeEvents,
  parseBuyEventsFromTable,
  scrollToLoadAllRows,
  setDateRangeInput,
  triggerSubmitForm,
  waitForTableOrNoData,
  yearRangeText
} from './collector';
import { renderChart } from './chartMount';
import {
  renderChartRules,
  renderDebugTable,
  renderPriceFetchReport,
  renderPriceModeToggle,
  renderValueModeToggle,
  type PriceMode,
  type ValueMode
} from './tableMount';
import {
  getBuyEvents,
  setBuyEvents,
  getPriceSeries,
  setPriceSeries,
  cachedPriceToDualSeries
} from './idb';
import { clearRunState, loadRunState, saveRunState } from './state';
import { getStopEventName, setStatus, setStatusDone, setStatusError } from './status';
import type { YahooFetchResp, YahooProxyError } from './yahooProxyTypes';

// BUY-only mode: compare incremental BUY cashflow performance
// from the site's earliest allowed date (daterangepicker.minDate) to today.
// Fallback when we cannot read daterangepicker.minDate from the page:
// minDate is typically "currentYear - 5" (e.g. 2026 -> 2021).
// const DEFAULT_FALLBACK_START_YEAR = 2025;
const DEFAULT_FALLBACK_START_YEAR = new Date().getFullYear() - 5;

declare const chrome: any;

const BUY_INPUT_ID = 'BuyInfo_QueryDateRange';
const BUY_TABLE_SELECTOR = '.query-result-area .buy-table-area table.buy-table.default-table.h5';

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

type DualSeries = { close: PriceSeries; adjclose: PriceSeries };
type FetchedTickerData = DualSeries & { splits: YahooSplitEvent[] };

let cachedEvents: TradeEvent[] | null = null;
let cachedByTicker: Map<string, DualSeries> | null = null;
let priceMode: PriceMode = 'close'; // default per user request
let valueMode: ValueMode = 'excess';
let cachedComputed: ReturnType<typeof computePortfolioVsVtiSeriesWithDebug> | null = null;


type PriceFetchAttemptLog = {
  ticker: string;
  year: number;
  /** When set, this request covered year–endYear (one API call per ticker). */
  endYear?: number;
  attempt: number;
  maxAttempts: number;
  url: string;
  outcome: 'ok' | 'retry' | 'fail';
  error?: YahooProxyError | { kind: 'parse'; message: string };
};

type PriceFetchReport = {
  startedAt: number;
  finishedAt?: number;
  logs: PriceFetchAttemptLog[];
  failedTickers: { ticker: string; reason: string }[];
};

let cachedFetchReport: PriceFetchReport | null = null;

function getMinDateYearFromPage(inputId: string): number {
    // return DEFAULT_FALLBACK_START_YEAR
    try {
        const w = window as unknown as { $?: any };
        const $ = w.$; // 豐存股用 jquery
        if (typeof $ !== 'function') return DEFAULT_FALLBACK_START_YEAR;
        const instance = $(`#${inputId}`)?.data?.('daterangepicker');
        const md = instance?.minDate;
        const y =
            md && typeof md.year === 'function'
            ? Number(md.year())
            : typeof md === 'string'
                ? Number((md.match(/(\d{4})/)?.[1] ?? ''))
                : Number.NaN;
        return Number.isFinite(y) && y > 1900 ? y : DEFAULT_FALLBACK_START_YEAR;
    } catch {
        return DEFAULT_FALLBACK_START_YEAR;
    }
}

async function fetchYahooJsonViaSw(url: string): Promise<YahooFetchResp> {
  if (typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) {
    return {
      ok: false,
      error: { kind: 'unknown', url, message: 'chrome.runtime is not available (extension service worker not reachable)' }
    };
  }
  return await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'YAHOO_FETCH_JSON', url }, (resp: YahooFetchResp | undefined) => {
      const err = chrome.runtime?.lastError;
      if (err) {
        resolve({ ok: false, error: { kind: 'unknown', url, message: `Service worker message failed: ${err.message ?? String(err)}` } });
        return;
      }
      if (!resp) {
        resolve({ ok: false, error: { kind: 'unknown', url, message: 'Unknown proxy error' } });
        return;
      }
      if (resp.ok === true) resolve({ ok: true, json: resp.json });
      else resolve({ ok: false, error: resp.error ?? { kind: 'unknown', url, message: 'Unknown proxy error' } });
    });
  });
}

function isoDateUtcTodayPlusOne(): string {
  const now = new Date();
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const plus = new Date(utc.getTime() + 86400_000);
  const y = plus.getUTCFullYear();
  const m = String(plus.getUTCMonth() + 1).padStart(2, '0');
  const d = String(plus.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function yearStartIsoUtc(year: number): string {
  return `${year}-01-01`;
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetriableYahooError(err: YahooProxyError): boolean {
  if (err.kind === 'network') return true;
  if (err.kind === 'http') {
    const s = err.status ?? 0;
    return s === 429 || (s >= 500 && s <= 599);
  }
  return false;
}

async function fetchYahooJsonWithRetry(
  args: { ticker: string; year: number; endYear?: number; url: string },
  report: PriceFetchReport,
  opts?: { maxRetries?: number }
): Promise<YahooFetchResp> {
  const maxRetries = opts?.maxRetries ?? 3; // total attempts = 1 + maxRetries
  const maxAttempts = 1 + maxRetries;
  const yearLabel = args.endYear != null ? `${args.year}-${args.endYear}` : String(args.year);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const resp = await fetchYahooJsonViaSw(args.url);
    if (resp.ok) {
      report.logs.push({
        ticker: args.ticker,
        year: args.year,
        ...(args.endYear != null ? { endYear: args.endYear } : {}),
        attempt,
        maxAttempts,
        url: args.url,
        outcome: 'ok'
      });
      return resp;
    }

    const retriable = isRetriableYahooError(resp.error);
    const isLast = attempt === maxAttempts;
    report.logs.push({
      ticker: args.ticker,
      year: args.year,
      ...(args.endYear != null ? { endYear: args.endYear } : {}),
      attempt,
      maxAttempts,
      url: args.url,
      outcome: retriable && !isLast ? 'retry' : 'fail',
      error: resp.error
    });

    if (!retriable || isLast) return resp;

    const backoffMs = 1000 * Math.pow(2, attempt - 1); // 1s/2s/4s...
    setStatus(`Yahoo 抓價重試中… ${args.ticker} (${yearLabel}) 第 ${attempt}/${maxAttempts} 次失敗，${backoffMs / 1000}s 後重試`, {
      spinning: true
    });
    await sleepMs(backoffMs);
  }

  // Unreachable
  return { ok: false, error: { kind: 'unknown', url: args.url, message: 'retry loop exhausted unexpectedly' } };
}

async function fetchAndParseSeriesPair(
  symbol: string,
  startYear: number,
  endYear: number,
  report: PriceFetchReport
): Promise<FetchedTickerData> {
  const mergedClose: PriceSeries = new Map();
  const mergedAdj: PriceSeries = new Map();
  const currentUtcYear = new Date().getUTCFullYear();
  const yahooSymbol = symbol.replace(/\./g, '-');

  const period1 = yearStartIsoUtc(startYear);
  const period2 =
    endYear === currentUtcYear ? isoDateUtcTodayPlusOne() : `${endYear + 1}-01-01`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSymbol
  )}?formatted=true&includeAdjustedClose=true&events=split&interval=1d&period1=${Math.floor(Date.parse(period1) / 1000)}&period2=${Math.floor(
    Date.parse(period2) / 1000
  )}`;

  setStatus(`抓取股價中… ${symbol}（${startYear}–${endYear}）`, { spinning: true });
  const resp = await fetchYahooJsonWithRetry(
    { ticker: symbol, year: startYear, endYear, url },
    report
  );
  if (!resp.ok) {
    throw specError('YAHOO_FETCH_FAILED', `Yahoo fetch failed: ${symbol} ${startYear}–${endYear}`, {
      symbol,
      startYear,
      endYear,
      error: resp.error,
      url
    });
  }

  let pair: ReturnType<typeof parseYahooChartToPriceSeriesPair>;
  let splits: YahooSplitEvent[] = [];
  try {
    pair = parseYahooChartToPriceSeriesPair(symbol, resp.json);
    splits = parseYahooChartSplits(symbol, resp.json);
  } catch (e) {
    report.logs.push({
      ticker: symbol,
      year: startYear,
      endYear: endYear,
      attempt: 1,
      maxAttempts: 1,
      url,
      outcome: 'fail',
      error: { kind: 'parse', message: e instanceof Error ? e.message : String(e) }
    });
    throw e;
  }

  for (const [k, v] of pair.close) mergedClose.set(k, v);
  for (const [k, v] of pair.adjclose) mergedAdj.set(k, v);

  return { close: mergedClose, adjclose: mergedAdj, splits };
}

function buildPriceSeriesByTicker(mode: PriceMode): Map<string, PriceSeries> {
  if (!cachedByTicker) throw specError('NO_CACHE', 'Missing cached price series');
  const out = new Map<string, PriceSeries>();
  for (const [t, dual] of cachedByTicker) out.set(t, mode === 'close' ? dual.close : dual.adjclose);
  return out;
}

function buildCloseAdjMaps(): { closeByTicker: Map<string, PriceSeries>; adjByTicker: Map<string, PriceSeries> } {
  if (!cachedByTicker) throw specError('NO_CACHE', 'Missing cached price series');
  const closeByTicker = new Map<string, PriceSeries>();
  const adjByTicker = new Map<string, PriceSeries>();
  for (const [t, dual] of cachedByTicker) {
    closeByTicker.set(t, dual.close);
    adjByTicker.set(t, dual.adjclose);
  }
  return { closeByTicker, adjByTicker };
}

function recomputeAndRender(): void {
  if (!cachedEvents || !cachedByTicker) return;
  const priceSeriesByTicker = buildPriceSeriesByTicker(priceMode);
  const computed = computePortfolioVsVtiSeriesWithDebug({
    events: cachedEvents,
    priceSeriesByTicker,
    maxBackTradingDays: 7,
    anchorTicker: 'VTI'
  });
  cachedComputed = computed;
  renderChart(computed, { valueMode });

  const { closeByTicker, adjByTicker } = buildCloseAdjMaps();
  renderDebugTable(computed.debugRows, {
    mode: priceMode,
    closeSeriesByTicker: closeByTicker,
    adjSeriesByTicker: adjByTicker,
    anchorTicker: 'VTI'
  });

  if (cachedFetchReport) renderPriceFetchReport(cachedFetchReport);
  // Keep chart rules stable after all blocks have potentially re-positioned.
  renderChartRules();
}

function rerenderChartOnly(): void {
  if (!cachedComputed) return;
  renderChart(cachedComputed, { valueMode });
  if (cachedFetchReport) renderPriceFetchReport(cachedFetchReport);
  // Value mode toggles may move sibling blocks; re-anchor chart rules last.
  renderChartRules();
}

function renderToggles(): void {
  renderPriceModeToggle(priceMode, (m) => {
    if (priceMode === m) return;
    priceMode = m;
    renderToggles();
    recomputeAndRender();
  });
  renderValueModeToggle(valueMode, (m) => {
    if (valueMode === m) return;
    valueMode = m;
    renderToggles();
    // Value mode is presentation-only; keep it fast.
    rerenderChartOnly();
  });
}

function showError(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  const div = document.createElement('div');
  div.style.padding = '12px';
  div.style.margin = '8px 0';
  div.style.border = '1px solid #fca5a5';
  div.style.background = '#fef2f2';
  div.style.color = '#991b1b';
  div.textContent = `豐存股折線圖產生失敗：${msg}`;
  const tagArea = document.querySelector('#TagSelectArea');
  if (tagArea) tagArea.appendChild(div);
  // Also log full error for debugging.
  console.error(err);
}

async function computeAndRender(events: any[]): Promise<void> {
  if (events.length === 0) throw specError('NO_EVENTS', 'No trade events found');

  // BUY-only: ignore all SELL events due to site history limitations.
  const buyOnlyEvents = (events as TradeEvent[]).filter((e) => e.type === 'BUY');
  if (buyOnlyEvents.length === 0) throw specError('NO_EVENTS', 'No BUY trade events found');

  const tickers = uniq(buyOnlyEvents.map((e) => e.ticker));
  const globalMinYear = Math.min(...buyOnlyEvents.map((e) => e.sourceYear));
  const globalMaxYear = Math.max(...buyOnlyEvents.map((e) => e.sourceYear));

  const yearRangeByTicker = new Map<string, { startYear: number; endYear: number }>();
  for (const ticker of tickers) {
    const years = buyOnlyEvents.filter((e) => e.ticker === ticker).map((e) => e.sourceYear);
    const minY = Math.min(...years);
    // Note: we intentionally do NOT add a "minY - 1" buffer year here.
    // If you later observe missing prices due to lookback across year boundary (early January events),
    // consider re-enabling a buffer year.
    //
    // IMPORTANT (BUY-only): if a ticker was bought in an earlier year but held into later years,
    // we still need prices through the overall compute horizon (globalMaxYear) for valuation.
    // Example: bought PG in 2021, held in 2022 => must fetch 2022 prices too.
    yearRangeByTicker.set(ticker, { startYear: Math.max(1900, minY), endYear: globalMaxYear });
  }
  // Anchor ticker (VTI) must cover the full date range.
  yearRangeByTicker.set('VTI', { startYear: Math.max(1900, globalMinYear), endYear: globalMaxYear });

  // Fetch once and cache both close/adjclose for fast toggle.
  const byTicker = new Map<string, DualSeries>();
  const splitsByTicker = new Map<string, YahooSplitEvent[]>();
  const report: PriceFetchReport = { startedAt: Date.now(), logs: [], failedTickers: [] };
  const allTickers = [...new Set<string>([...tickers, 'VTI'])];
  console.log('===allTickers===', allTickers);
  const effectiveEvents: TradeEvent[] = [...buyOnlyEvents];

  for (const ticker of allTickers) {
    const range = yearRangeByTicker.get(ticker);
    if (!range) continue;
    try {
      const cached = await getPriceSeries(ticker);
      const rangeCovered =
        cached &&
        cached.startYear <= range.startYear &&
        cached.endYear >= range.endYear;
      let dual: DualSeries;
      let splits: YahooSplitEvent[] = [];
      if (rangeCovered) {
        dual = cachedPriceToDualSeries(cached);
        splits = cached.splits;
      } else {
        const fetched = await fetchAndParseSeriesPair(ticker, range.startYear, range.endYear, report);
        dual = { close: fetched.close, adjclose: fetched.adjclose };
        splits = fetched.splits;
        await setPriceSeries(ticker, range.startYear, range.endYear, dual.close, dual.adjclose, splits);
      }
      byTicker.set(ticker, dual);
      splitsByTicker.set(ticker, splits);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      report.failedTickers.push({ ticker: ticker, reason: msg });

      // Anchor ticker cannot be skipped.
      if (ticker === 'VTI') throw e;

      // Allow user to decide: stop or skip this ticker's events.
      const skip = window.confirm(
        `抓價失敗：${ticker}\n原因：${msg}\n\n按「確定」跳過此 ticker 的事件繼續計算；按「取消」停止。`
      );
      if (!skip) throw e;

      // Skip: remove all events for this ticker and do not include its price series.
      for (let i = effectiveEvents.length - 1; i >= 0; i -= 1) {
        if (effectiveEvents[i]?.ticker === ticker) effectiveEvents.splice(i, 1);
      }
    }
  }
  report.finishedAt = Date.now();
  const normalizedEvents = normalizeBuyEventsBySplits(effectiveEvents, splitsByTicker);

  cachedEvents = normalizedEvents;
  cachedByTicker = byTicker;
  cachedFetchReport = report;

  // Mount toggles and initial render (default: Close + Percent).
  renderToggles();
  recomputeAndRender();
}

async function startFlow(): Promise<void> {
  const startedAt = Date.now();
  const startYear = getMinDateYearFromPage(BUY_INPUT_ID);
  const endYear = new Date().getFullYear();
  const y = startYear;
  const rangeText = yearRangeText(y);

  setStatus(`抓取買入資料中…（${rangeText}）\n模式：BUY-only（SELL 事件不納入比較）`, { spinning: true });
  await setDateRangeInput(BUY_INPUT_ID, rangeText);

  // Persist BEFORE submitting because submit triggers a full reload (execution stops).
  await saveRunState({
    v: 1,
    stage: 'buy_submitted',
    startedAt,
    startYear,
    endYear,
    cursorYear: y,
    rangeText,
    buyEvents: [],
    sellEvents: []
  });

  triggerSubmitForm();
}

async function resumeIfNeeded(): Promise<boolean> {
  const state = await loadRunState();
  if (!state || state.v !== 1) return false;

  // BUY-only mode supports only buy_submitted -> computing. If an old state exists from
  // previous versions (sell stages), reset it to avoid confusing auto-resume loops.
  if (state.stage !== 'buy_submitted' && state.stage !== 'computing') {
    await clearRunState();
    setStatusDone('已重置舊版狀態，請重新點擊按鈕開始（BUY-only）');
    return true;
  }

  // If submit caused reload, resume from persisted stage.
  if (state.stage === 'buy_submitted') {
    const y = state.cursorYear;
    const rangeText = state.rangeText ?? yearRangeText(y);
    setStatus(`解析買入資料中…（${rangeText}）\n模式：BUY-only（SELL 事件不納入比較）`, { spinning: true });

    const res = await waitForTableOrNoData(BUY_TABLE_SELECTOR, rangeText, {
      inputIdForEmptyCheck: BUY_INPUT_ID
    });
    const yearEvents =
      res.kind === 'table'
        ? (await scrollToLoadAllRows(res.table), parseBuyEventsFromTable(res.table, { year: y, rangeText }))
        : [];

    const merged = dedupeEvents([...(state.buyEvents ?? []), ...yearEvents]);
    try {
      localStorage.setItem('pvs_debug_buyEvents_v1', JSON.stringify({ at: Date.now(), buy: merged }));
    } catch {}

    if (y < state.endYear) {
      const nextYear = y + 1;
      const nextRange = yearRangeText(nextYear);
      setStatus(`抓取買入資料中…（${nextRange}）\n模式：BUY-only（SELL 事件不納入比較）`, { spinning: true });
      await setDateRangeInput(BUY_INPUT_ID, nextRange);
      await saveRunState({ ...state, stage: 'buy_submitted', cursorYear: nextYear, rangeText: nextRange, buyEvents: merged });
      triggerSubmitForm();
      return true;
    }

    // BUY-only: compute immediately after finishing buy collection.
    const events: TradeEvent[] = merged;
    try {
      localStorage.setItem('pvs_debug_events_v1', JSON.stringify({ at: Date.now(), events, mode: 'BUY_ONLY' }));
    } catch {}

    await setBuyEvents(state.startYear, state.endYear, events);

    await saveRunState({ ...state, stage: 'computing', buyEvents: merged });
    setStatus('計算與產生圖表中…\n模式：BUY-only（SELL 事件不納入比較）', { spinning: true });
    await computeAndRender(events);
    await clearRunState();
    setStatusDone('已完成');
    return true;
  }

  if (state.stage === 'computing') {
    // If we ever reload mid-compute, allow user to re-run from scratch.
    setStatus('上次執行停在計算階段，請重新點擊按鈕再跑一次。', { spinning: false });
    return true;
  }

  return false;
}

function mountButton(): void {
  console.log('mountButton');
  if (document.querySelector('#portfolio-vti-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'portfolio-vti-btn';
  btn.textContent = '產生折線圖';
  btn.style.position = 'fixed';
  btn.style.right = '16px';
  btn.style.bottom = '16px';
  btn.style.zIndex = '999999';
  btn.style.padding = '10px 12px';
  btn.style.borderRadius = '10px';
  btn.style.border = '1px solid #111827';
  btn.style.background = '#111827';
  btn.style.color = '#fff';
  btn.style.cursor = 'pointer';
  btn.onclick = async () => {
    btn.disabled = true;
    try {
      const startYear = getMinDateYearFromPage(BUY_INPUT_ID);
      const endYear = new Date().getFullYear();
      const cached = await getBuyEvents();
      const cacheHit =
        cached &&
        cached.events.length > 0 &&
        cached.startYear === startYear &&
        cached.endYear === endYear;
      if (cacheHit) {
        setStatus('使用快取買入資料，計算與產生圖表中…', { spinning: true });
        await computeAndRender(cached.events);
        setStatusDone('已完成');
        return;
      }
      await clearRunState();
      await startFlow();
    } catch (e) {
      showError(e);
      setStatusError(`mountButton-產生失敗：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      btn.disabled = false;
    }
  };
  document.body.appendChild(btn);
}

mountButton();

// Manual stop/reset: clears persisted state so refresh won't resume.
window.addEventListener(getStopEventName(), () => {
  clearRunState()
    .then(() => setStatusDone('已停止（狀態已重置）'))
    .catch((e) => {
      console.error(e);
      setStatusError(`停止失敗：${e instanceof Error ? e.message : String(e)}`);
    });
});

// Auto-resume if switching tab caused reload.
resumeIfNeeded().catch((e) => {
  console.error(e);
  setStatusError(`resumeIfNeeded-產生失敗：${e instanceof Error ? e.message : String(e)}（已重置狀態）`);
  clearRunState().catch((err) => console.error(err));
});

