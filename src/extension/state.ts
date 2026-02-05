import type { TradeEvent } from '../core';

const KEY = 'portfolio-vti-run-state-v1';

declare const chrome: any;

export type RunStage =
  | 'idle'
  // Buy flow: we submit a year query, page reloads, then we parse.
  | 'buy_submitted'
  // Switching to sell tab may reload.
  | 'need_sell_tab'
  // Sell flow: we submit a year query, page reloads, then we parse.
  | 'sell_submitted'
  // Final compute + render stage (should not normally reload, but keep for recovery).
  | 'computing';

export interface PersistedRunState {
  v: 1;
  stage: RunStage;
  startedAt: number;
  startYear: number;
  endYear: number;
  cursorYear: number;
  /** Range text we last submitted, e.g. "2022/01/01 ~ 2022/12/31" */
  rangeText?: string;
  buyEvents?: TradeEvent[];
  sellEvents?: TradeEvent[];
}

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome?.storage?.local;
}

function chromeGet(): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([KEY], (items: Record<string, unknown>) => {
      const err = chrome.runtime?.lastError;
      if (err) reject(err);
      else resolve(items as Record<string, unknown>);
    });
  });
}

function chromeSet(value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [KEY]: value }, () => {
      const err = chrome.runtime?.lastError;
      if (err) reject(err);
      else resolve();
    });
  });
}

function chromeRemove(): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove([KEY], () => {
      const err = chrome.runtime?.lastError;
      if (err) reject(err);
      else resolve();
    });
  });
}

export async function loadRunState(): Promise<PersistedRunState | null> {
  try {
    if (hasChromeStorage()) {
      const items = await chromeGet();
      const v = items[KEY];
      return (v as PersistedRunState) ?? null;
    }
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PersistedRunState) : null;
  } catch {
    return null;
  }
}

export async function saveRunState(state: PersistedRunState): Promise<void> {
  if (hasChromeStorage()) {
    await chromeSet(state);
    return;
  }
  sessionStorage.setItem(KEY, JSON.stringify(state));
}

export async function clearRunState(): Promise<void> {
  if (hasChromeStorage()) {
    await chromeRemove();
    return;
  }
  sessionStorage.removeItem(KEY);
}

