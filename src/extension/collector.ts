import { parseBuyTable, parseSellTable, type TradeEvent } from '../core';
import { specError } from '../core/errors';
import { mustQuery, dispatchEnter, sleep, waitFor } from './dom';

function formatYmd(year: number, month: number, day: number): string {
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return `${year}/${pad2(month)}/${pad2(day)}`;
}

function todayYmd(): { y: number; m: number; d: number } {
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
}

export function yearRangeText(year: number): string {
  const start = formatYmd(year, 1, 1);
  const { y, m, d } = todayYmd();
  const end = year < y ? formatYmd(year, 12, 31) : formatYmd(y, m, d);
  return `${start} ~ ${end}`;
}

function normalizeText(s: string): string {
  return s.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractYmdFromText(text: string): string {
  const m = text.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!m) return '';
  const y = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return `${y}/${pad2(mm)}/${pad2(dd)}`;
}

function parseRangeStartEnd(rangeText: string): { start: string; end: string } {
  const dates = rangeText.match(/\d{4}\/\d{2}\/\d{2}/g) ?? [];
  return { start: dates[0] ?? '', end: dates[1] ?? '' };
}

function setNativeValue(input: HTMLInputElement, value: string): void {
  const proto = Object.getPrototypeOf(input) as any;
  const desc =
    Object.getOwnPropertyDescriptor(proto, 'value') || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  const setter = desc?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
}

export async function setDateRangeInput(inputId: string, rangeText: string): Promise<void> {
  const input = mustQuery<HTMLInputElement>(document, `#${inputId}`);
  input.focus();
  setNativeValue(input, rangeText);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  // Allow reactive handlers to run.
  await sleep(0);
  // Keep Enter as a best-effort trigger (some pages listen on key events).
  dispatchEnter(input);
  await sleep(0);
  try {
    localStorage.setItem(
      `pvs_debug_lastRange_${inputId}`,
      JSON.stringify({ at: Date.now(), tried: rangeText, actual: String(input.value) })
    );
  } catch {}
}

export function triggerSubmitForm(): void {
  const w = window as unknown as { SubmitForm?: () => void };
  if (typeof w.SubmitForm === 'function') {
    w.SubmitForm();
    return;
  }
  const form = document.querySelector('#form1') as HTMLFormElement | null;
  if (form) {
    if (typeof (form as any).requestSubmit === 'function') (form as any).requestSubmit();
    else form.submit();
    return;
  }
  throw specError('DOM_NOT_FOUND', 'Missing SubmitForm() and #form1', { hasSubmitForm: typeof w.SubmitForm });
}

function getFirstRowTradeDate(table: HTMLTableElement): string {
  const ths = Array.from(table.querySelectorAll('thead th'));
  const idx = ths.findIndex((th) => normalizeText(th.textContent ?? '') === '成交日');
  if (idx < 0) return '';
  const firstRow = table.querySelector('tbody tr') as HTMLTableRowElement | null;
  if (!firstRow) return '';
  const td = firstRow.querySelectorAll('td')[idx] as HTMLTableCellElement | undefined;
  return extractYmdFromText(normalizeText(td?.textContent ?? ''));
}

export async function waitForTableFirstDateInRange(
  tableSelector: string,
  rangeText: string,
  opts: { timeoutMs?: number; inputIdForEmptyCheck?: string } = {}
): Promise<HTMLTableElement> {
  const { start: expectedStart, end: expectedEnd } = parseRangeStartEnd(rangeText);
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const inputId = opts.inputIdForEmptyCheck;

  return await waitFor(
    () => {
      const table = document.querySelector(tableSelector) as HTMLTableElement | null;
      if (!table) return null;
      if (!expectedStart || !expectedEnd) return table;

      const firstDate = getFirstRowTradeDate(table);
      if (firstDate) {
        const inRange = firstDate >= expectedStart && firstDate <= expectedEnd;
        return inRange ? table : null;
      }

      // Accept empty results when the input range is applied (avoid dead-wait on years with no trades).
      const rowCount = table.querySelectorAll('tbody tr').length;
      if (rowCount === 0 && inputId) {
        const input = document.querySelector(`#${inputId}`) as HTMLInputElement | null;
        const v = input?.value ?? '';
        if (v.includes(expectedStart) && v.includes(expectedEnd)) return table;
      }
      return null;
    },
    { debugName: `table updated for ${rangeText}`, timeoutMs }
  );
}

export async function scrollToLoadAllRows(table: HTMLTableElement): Promise<void> {
  // Try to find a scrollable container.
  let scroller: HTMLElement | null = table.parentElement;
  for (let i = 0; i < 5 && scroller; i += 1) {
    if (scroller.scrollHeight > scroller.clientHeight + 10) break;
    scroller = scroller.parentElement;
  }
  const target = scroller ?? document.scrollingElement ?? document.documentElement;

  let stableTicks = 0;
  let lastCount = -1;
  for (let i = 0; i < 60; i += 1) {
    const count = table.querySelectorAll('tbody tr').length;
    if (count === lastCount) stableTicks += 1;
    else stableTicks = 0;
    lastCount = count;
    if (stableTicks >= 3) return;

    if (target instanceof HTMLElement) {
      target.scrollTop = target.scrollHeight;
    } else {
      window.scrollTo(0, document.body.scrollHeight);
    }
    await sleep(250);
  }
}

export function dedupeEvents(events: TradeEvent[]): TradeEvent[] {
  const seen = new Set<string>();
  const out: TradeEvent[] = [];
  for (const e of events) {
    const key = `${e.type}|${e.isoDateET}|${e.ticker}|${e.shares}|${e.cash}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

export async function switchToSellTab(): Promise<void> {
  const tagArea = mustQuery<HTMLElement>(document, '#TagSelectArea');
  const tabs = Array.from(tagArea.querySelectorAll<HTMLElement>('.tag-select-header'));
  const sell = tabs.find((t) => (t.textContent ?? '').includes('賣出'));
  if (!sell) throw specError('DOM_NOT_FOUND', 'Cannot find sell tab', { tabs: tabs.map((t) => t.textContent) });
  sell.click();
  await sleep(300);
}

export function parseBuyEventsFromTable(table: HTMLTableElement, ctx?: Record<string, unknown>): TradeEvent[] {
  return parseBuyTable(table, ctx);
}

export function parseSellEventsFromTable(table: HTMLTableElement, ctx?: Record<string, unknown>): TradeEvent[] {
  return parseSellTable(table, ctx);
}

