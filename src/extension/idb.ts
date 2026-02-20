import type { TradeEvent } from '../core';
import type { PriceSeries } from '../core';

const DB_NAME = 'pvs-cache-v1';
const DB_VERSION = 1;
const STORE_BUY_EVENTS = 'buyEvents';
const STORE_PRICE_SERIES = 'priceSeries';
const KEY_MAIN = 'main';

export interface CachedBuyEvents {
  startYear: number;
  endYear: number;
  events: TradeEvent[];
}

export interface CachedPriceSeries {
  ticker: string;
  startYear: number;
  endYear: number;
  /** Serialized: array of [isoDateET, price] */
  close: [string, number][];
  adjclose: [string, number][];
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (ev) => {
      const db = (ev.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_BUY_EVENTS)) {
        db.createObjectStore(STORE_BUY_EVENTS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_PRICE_SERIES)) {
        db.createObjectStore(STORE_PRICE_SERIES, { keyPath: 'ticker' });
      }
    };
  });
}

/** Returns cached buy events if range matches page range. */
export async function getBuyEvents(): Promise<CachedBuyEvents | null> {
  const db = await openDb();
  return new Promise<CachedBuyEvents | null>((resolve, reject) => {
    const tx = db.transaction(STORE_BUY_EVENTS, 'readonly');
    const store = tx.objectStore(STORE_BUY_EVENTS);
    const req = store.get(KEY_MAIN);
    req.onsuccess = () => {
      const row = req.result as { key: string; startYear: number; endYear: number; events: TradeEvent[] } | undefined;
      if (!row || !Array.isArray(row.events)) {
        resolve(null);
        return;
      }
      resolve({
        startYear: row.startYear,
        endYear: row.endYear,
        events: row.events as TradeEvent[]
      });
    };
    req.onerror = () => reject(req.error);
    tx.onerror = () => reject(tx.error);
  }).finally(() => db.close());
}

/** Save merged buy events after crawl (range = page startYear..endYear). */
export async function setBuyEvents(
  startYear: number,
  endYear: number,
  events: TradeEvent[]
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BUY_EVENTS, 'readwrite');
    const store = tx.objectStore(STORE_BUY_EVENTS);
    const req = store.put({ key: KEY_MAIN, startYear, endYear, events });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => db.close();
  });
}

/** Get cached price series for a ticker. Caller checks if range covers needed startYear..endYear. */
export async function getPriceSeries(ticker: string): Promise<CachedPriceSeries | null> {
  const db = await openDb();
  return new Promise<CachedPriceSeries | null>((resolve, reject) => {
    const tx = db.transaction(STORE_PRICE_SERIES, 'readonly');
    const store = tx.objectStore(STORE_PRICE_SERIES);
    const req = store.get(ticker);
    req.onsuccess = () => {
      const row = req.result as CachedPriceSeries | undefined;
      if (!row || !Array.isArray(row.close) || !Array.isArray(row.adjclose)) {
        resolve(null);
        return;
      }
      resolve(row);
    };
    req.onerror = () => reject(req.error);
    tx.onerror = () => reject(tx.error);
  }).finally(() => db.close());
}

/** Save price series after fetch. */
export async function setPriceSeries(
  ticker: string,
  startYear: number,
  endYear: number,
  close: PriceSeries,
  adjclose: PriceSeries
): Promise<void> {
  const closeArr: [string, number][] = Array.from(close.entries());
  const adjcloseArr: [string, number][] = Array.from(adjclose.entries());
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRICE_SERIES, 'readwrite');
    const store = tx.objectStore(STORE_PRICE_SERIES);
    const req = store.put({
      ticker,
      startYear,
      endYear,
      close: closeArr,
      adjclose: adjcloseArr
    });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => db.close();
  });
}

/** Build close/adjclose Maps from cached format. */
export function cachedPriceToDualSeries(cached: CachedPriceSeries): {
  close: PriceSeries;
  adjclose: PriceSeries;
} {
  const close: PriceSeries = new Map(cached.close);
  const adjclose: PriceSeries = new Map(cached.adjclose);
  return { close, adjclose };
}
