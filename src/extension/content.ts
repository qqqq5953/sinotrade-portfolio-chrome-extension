import {
  computePortfolioVsVtiSeriesWithDebug,
  parseYahooChartToPriceSeriesPair,
  type PriceSeries,
  type TradeEvent
} from '../core';
import { specError } from '../core/errors';
import {
  dedupeEvents,
  parseBuyEventsFromTable,
  parseSellEventsFromTable,
  scrollToLoadAllRows,
  setDateRangeInput,
  switchToSellTab,
  triggerSubmitForm,
  waitForTableOrNoData,
  waitForTableFirstDateInRange,
  yearRangeText
} from './collector';
import { renderChart } from './chartMount';
import { renderDebugTable, renderPriceModeToggle, type PriceMode } from './tableMount';
import { clearRunState, loadRunState, saveRunState } from './state';
import { getStopEventName, setStatus, setStatusDone, setStatusError } from './status';

// Temporary test range (per user request): 2025/01/01 ~ today.
const TEST_START_YEAR = 2021;
const TEST_END_YEAR = 2023;
// const TEST_END_YEAR = new Date().getFullYear();

declare const chrome: any;

const BUY_INPUT_ID = 'BuyInfo_QueryDateRange';
const BUY_TABLE_SELECTOR = '.query-result-area .buy-table-area table.buy-table.default-table.h5';
const SELL_INPUT_ID = 'SellInfo_QueryDateRange';
const SELL_TABLE_SELECTOR = '.query-result-area .sell-table-area table.sell-table.default-table.h5';

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

type DualSeries = { close: PriceSeries; adjclose: PriceSeries };

let cachedEvents: TradeEvent[] | null = null;
let cachedByTicker: Map<string, DualSeries> | null = null;
let priceMode: PriceMode = 'close'; // default per user request

type YahooFetchResp = { ok: true; json: unknown } | { ok: false; error: string };

async function fetchYahooJsonViaSw(url: string): Promise<unknown> {
  if (typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) {
    throw specError('NO_CHROME_RUNTIME', 'chrome.runtime is not available (extension service worker not reachable)', { url });
  }
  return await new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'YAHOO_FETCH_JSON', url }, (resp: YahooFetchResp | undefined) => {
      const err = chrome.runtime?.lastError;
      if (err) {
        reject(specError('SW_MESSAGE', `Service worker message failed: ${err.message ?? String(err)}`, { url }));
        return;
      }
      if (!resp || resp.ok !== true) {
        reject(specError('YAHOO_PROXY', (resp as any)?.error ?? 'Unknown proxy error', { url }));
        return;
      }
      resolve(resp.json);
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

async function fetchAndParseSeries(symbol: string, startYear: number, endYear: number): Promise<PriceSeries> {
  // Backward-compatible (no longer used). Kept to avoid churn.
  const merged: PriceSeries = new Map();
  const currentUtcYear = new Date().getUTCFullYear();
  // Yahoo uses "-" for class shares, e.g. "BRK.B" -> "BRK-B".
  const yahooSymbol = symbol.replace(/\./g, '-');
  for (let y = startYear; y <= endYear; y += 1) {
    const period1 = yearStartIsoUtc(y);
    const period2 = y === currentUtcYear ? isoDateUtcTodayPlusOne() : `${y + 1}-01-01`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      yahooSymbol
    )}?formatted=true&includeAdjustedClose=true&interval=1d&period1=${Math.floor(Date.parse(period1) / 1000)}&period2=${Math.floor(
      Date.parse(period2) / 1000
    )}`;
    const json = await fetchYahooJsonViaSw(url);
    const pair = parseYahooChartToPriceSeriesPair(symbol, json);
    for (const [k, v] of pair.close) merged.set(k, v);
  }
  return merged;
}

async function fetchAndParseSeriesPair(symbol: string, startYear: number, endYear: number): Promise<DualSeries> {
  const mergedClose: PriceSeries = new Map();
  const mergedAdj: PriceSeries = new Map();
  const currentUtcYear = new Date().getUTCFullYear();
  const yahooSymbol = symbol.replace(/\./g, '-');

  for (let y = startYear; y <= endYear; y += 1) {
    const period1 = yearStartIsoUtc(y);
    const period2 = y === currentUtcYear ? isoDateUtcTodayPlusOne() : `${y + 1}-01-01`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      yahooSymbol
    )}?formatted=true&includeAdjustedClose=true&interval=1d&period1=${Math.floor(Date.parse(period1) / 1000)}&period2=${Math.floor(
      Date.parse(period2) / 1000
    )}`;
    const json = await fetchYahooJsonViaSw(url);
    console.log('symbol', symbol, 'period1', period1, 'period2', period2, 'json', json);
    const pair = parseYahooChartToPriceSeriesPair(symbol, json);
    for (const [k, v] of pair.close) mergedClose.set(k, v);
    for (const [k, v] of pair.adjclose) mergedAdj.set(k, v);
  }

  return { close: mergedClose, adjclose: mergedAdj };
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
  renderChart(computed);

  const { closeByTicker, adjByTicker } = buildCloseAdjMaps();
  renderDebugTable(computed.debugRows, {
    mode: priceMode,
    closeSeriesByTicker: closeByTicker,
    adjSeriesByTicker: adjByTicker,
    anchorTicker: 'VTI'
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

  const tickers = uniq(events.map((e) => e.ticker));
  const startYear = Math.min(...events.map((e) => e.sourceYear));
  const endYear = Math.max(...events.map((e) => e.sourceYear));

  // Fetch once and cache both close/adjclose for fast toggle.
  const byTicker = new Map<string, DualSeries>();
  for (const t of [...tickers, 'VTI']) {
    const dual = await fetchAndParseSeriesPair(t, startYear, endYear);
    byTicker.set(t, dual);
  }

  cachedEvents = events as TradeEvent[];
  cachedByTicker = byTicker;

  // Mount toggle and initial render (default: close).
  renderPriceModeToggle(priceMode, (m) => {
    if (priceMode === m) return;
    priceMode = m;
    // Update toggle UI to reflect active state.
    renderPriceModeToggle(priceMode, (m2) => {
      if (priceMode === m2) return;
      priceMode = m2;
      recomputeAndRender();
    });
    recomputeAndRender();
  });

  recomputeAndRender();
}

async function startFlow(): Promise<void> {
  const startedAt = Date.now();
  const y = TEST_START_YEAR;
  const rangeText = yearRangeText(y);

  setStatus(`抓取買入資料中…（${rangeText}）`, { spinning: true });
  await setDateRangeInput(BUY_INPUT_ID, rangeText);

  // Persist BEFORE submitting because submit triggers a full reload (execution stops).
  await saveRunState({
    v: 1,
    stage: 'buy_submitted',
    startedAt,
    startYear: TEST_START_YEAR,
    endYear: TEST_END_YEAR,
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

  // If submit caused reload, resume from persisted stage.
  if (state.stage === 'buy_submitted') {
    const y = state.cursorYear;
    const rangeText = state.rangeText ?? yearRangeText(y);
    setStatus(`解析買入資料中…（${rangeText}）`, { spinning: true });

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
      setStatus(`抓取買入資料中…（${nextRange}）`, { spinning: true });
      await setDateRangeInput(BUY_INPUT_ID, nextRange);
      await saveRunState({ ...state, stage: 'buy_submitted', cursorYear: nextYear, rangeText: nextRange, buyEvents: merged });
      triggerSubmitForm();
      return true;
    }

    // Buy done → switch to sell tab (may reload). Persist stage BEFORE clicking.
    await saveRunState({
      ...state,
      stage: 'need_sell_tab',
      cursorYear: state.startYear,
      buyEvents: merged
    });
    setStatus('切換到賣出頁面中…', { spinning: true });
    await switchToSellTab();
    return true;
  }

  if (state.stage === 'need_sell_tab') {
    // After reload, ensure we are on sell tab.
    if (!document.querySelector(`#${SELL_INPUT_ID}`)) {
      setStatus('切換到賣出頁面中…', { spinning: true });
      await switchToSellTab();
      return true;
    }
    const y = state.startYear;
    const rangeText = yearRangeText(y);
    setStatus(`抓取賣出資料中…（${rangeText}）`, { spinning: true });
    await setDateRangeInput(SELL_INPUT_ID, rangeText);
    await saveRunState({ ...state, stage: 'sell_submitted', cursorYear: y, rangeText });
    triggerSubmitForm();
    return true;
  }

  if (state.stage === 'sell_submitted') {
    const y = state.cursorYear;
    const rangeText = state.rangeText ?? yearRangeText(y);
    setStatus(`解析賣出資料中…（${rangeText}）`, { spinning: true });

    const res = await waitForTableOrNoData(SELL_TABLE_SELECTOR, rangeText, {
      inputIdForEmptyCheck: SELL_INPUT_ID
    });
    const yearEvents =
      res.kind === 'table'
        ? (await scrollToLoadAllRows(res.table), parseSellEventsFromTable(res.table, { year: y, rangeText }))
        : [];
    const mergedSell = dedupeEvents([...(state.sellEvents ?? []), ...yearEvents]);
    try {
      localStorage.setItem('pvs_debug_sellEvents_v1', JSON.stringify({ at: Date.now(), sell: mergedSell }));
    } catch {}

    if (y < state.endYear) {
      const nextYear = y + 1;
      const nextRange = yearRangeText(nextYear);
      setStatus(`抓取賣出資料中…（${nextRange}）`, { spinning: true });
      await setDateRangeInput(SELL_INPUT_ID, nextRange);
      await saveRunState({ ...state, stage: 'sell_submitted', cursorYear: nextYear, rangeText: nextRange, sellEvents: mergedSell });
      triggerSubmitForm();
      return true;
    }

    const buy = state.buyEvents ?? [];
    const events: TradeEvent[] = [...buy, ...mergedSell];
    try {
      localStorage.setItem('pvs_debug_events_v1', JSON.stringify({ at: Date.now(), events }));
    } catch {}

    await saveRunState({ ...state, stage: 'computing', sellEvents: mergedSell });
    setStatus('計算與產生圖表中…', { spinning: true });
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

