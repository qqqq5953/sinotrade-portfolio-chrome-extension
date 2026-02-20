import type { YahooChartResponse } from "../core/yahoo";
import type { YahooFetchResp, YahooProxyError } from "./yahooProxyTypes";

declare const chrome: any;

type YahooFetchMsg = { type: 'YAHOO_FETCH_JSON'; url: string };


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
chrome.runtime.onMessage.addListener((msg: unknown, _sender: unknown, sendResponse: (resp: YahooFetchResp) => void) => {
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
});

