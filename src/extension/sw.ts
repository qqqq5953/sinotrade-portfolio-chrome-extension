declare const chrome: any;

type YahooFetchMsg = { type: 'YAHOO_FETCH_JSON'; url: string };
type YahooFetchResp = { ok: true; json: unknown } | { ok: false; error: string };

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
  return await res.json();
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
    const error = e instanceof Error ? e.message : String(e);
    sendResponse({ ok: false, error });
  });

  // Indicate async response.
  return true;
});

