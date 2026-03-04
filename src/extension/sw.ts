import type { YahooChartResponse } from '../core/integration/yahoo';
import type { YahooFetchResp, YahooProxyError } from './yahooProxyTypes';

declare const chrome: any;

type YahooFetchMsg = { type: 'YAHOO_FETCH_JSON'; url: string };

const TRANSACTION_URL_PREFIX = 'https://aiinvest.sinotrade.com.tw/Account/Transaction';
const STORAGE_KEY_ENABLED = 'pvs_enabled_for_transaction';

async function fetchJson(url: string): Promise<YahooChartResponse> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.log('===not ok===', { url, status: res.status });
      const err: YahooProxyError = { kind: 'http', url, status: res.status, message: `Yahoo HTTP ${res.status}` };
      throw err;
    }
    return await res.json();
  } catch (e) {
    // Re-throw our structured error if already in that shape.
    if (e && typeof e === 'object' && 'kind' in e && 'url' in e && 'message' in e) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    const err: YahooProxyError = {
      kind: e instanceof TypeError ? 'network' : 'unknown',
      url,
      message: msg
    };
    throw err;
  }
}

// Content scripts are subject to page CORS. Use the extension service worker as a proxy.
chrome.runtime.onMessage.addListener(
  (msg: unknown, _sender: unknown, sendResponse: (resp: YahooFetchResp) => void) => {
    const m = msg as Partial<YahooFetchMsg> | null;
    if (!m || m.type !== 'YAHOO_FETCH_JSON' || typeof m.url !== 'string') return;
    const url = m.url;

    (async () => {
      const json = await fetchJson(url);
      sendResponse({ ok: true, json });
    })().catch((e) => {
      const error: YahooProxyError =
        e && typeof e === 'object' && 'kind' in e && 'url' in e && 'message' in e
          ? (e as YahooProxyError)
          : { kind: 'unknown', url, message: e instanceof Error ? e.message : String(e) };
      sendResponse({ ok: false, error });
    });

    // Indicate async response.
    return true;
  }
);

async function getEnabledForTransaction(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!chrome?.storage?.local) {
      resolve(true);
      return;
    }
    chrome.storage.local.get([STORAGE_KEY_ENABLED], (items: Record<string, unknown>) => {
      const raw = items?.[STORAGE_KEY_ENABLED];
      // Default: enabled when not explicitly set to false.
      resolve(raw !== false);
    });
  });
}

async function setEnabledForTransaction(enabled: boolean): Promise<void> {
  return new Promise((resolve) => {
    if (!chrome?.storage?.local) {
      resolve();
      return;
    }
    chrome.storage.local.set({ [STORAGE_KEY_ENABLED]: enabled }, () => resolve());
  });
}

async function updateActionForTab(tabId: number, url: string | undefined | null): Promise<void> {
  if (!chrome?.action) return;
  const isSupported = typeof url === 'string' && url.startsWith(TRANSACTION_URL_PREFIX);
  if (!isSupported) {
    await chrome.action.setBadgeText({ tabId, text: '' });
    await chrome.action.setTitle({
      tabId,
      title: '豐存股交易折線圖：僅在豐存股交易頁啟用'
    });
    return;
  }

  const enabled = await getEnabledForTransaction();
  await chrome.action.setTitle({
    tabId,
    title: enabled ? '豐存股交易折線圖（此網站已啟用）' : '豐存股交易折線圖（此網站已停用）'
  });
  await chrome.action.setBadgeText({ tabId, text: enabled ? 'ON' : 'OFF' });
  await chrome.action.setBadgeBackgroundColor({
    tabId,
    color: enabled ? '#16a34a' : '#9ca3af'
  });
}

chrome.action?.onClicked.addListener(async (tab: any) => {
  const tabId = tab.id;
  const url = tab.url;
  if (tabId == null) return;

  const isSupported = typeof url === 'string' && url.startsWith(TRANSACTION_URL_PREFIX);
  if (!isSupported) {
    await chrome.action.setBadgeText({ tabId, text: '!' });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#f97316' });
    await chrome.action.setTitle({
      tabId,
      title: '此擴充功能僅適用於豐存股交易頁'
    });
    return;
  }

  const current = await getEnabledForTransaction();
  const next = !current;
  await setEnabledForTransaction(next);
  await updateActionForTab(tabId, url);
});

chrome.tabs?.onActivated.addListener(async (info: any) => {
  try {
    const tab = await chrome.tabs.get(info.tabId);
    await updateActionForTab(tab.id!, tab.url);
  } catch {
    // ignore
  }
});

chrome.tabs?.onUpdated.addListener((tabId: number, changeInfo: any, tab: any) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    updateActionForTab(tabId, tab.url);
  }
});