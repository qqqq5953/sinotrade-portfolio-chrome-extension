import { toIsoDateETFromYmdSlash } from './date';
import { specError } from './errors';
import { parseNumberStrict } from './number';
import type { TradeEvent, TradeType } from './types';

function normalizeText(s: string): string {
  return s.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractYmdFromCellText(text: string, ctx?: Record<string, unknown>): string {
  const m = text.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!m) throw specError('PARSE_DATE_CELL', `Cannot parse date from cell: "${text}"`, { text, ...ctx });
  const y = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return `${y}/${pad2(mm)}/${pad2(dd)}`;
}

function headerIndexMap(table: HTMLTableElement): Map<string, number> {
  const ths = Array.from(table.querySelectorAll('thead th'));
  const map = new Map<string, number>();
  ths.forEach((th, idx) => {
    const key = normalizeText(th.textContent ?? '');
    if (key) map.set(key, idx);
  });
  return map;
}

function getCellText(tr: HTMLTableRowElement, idx: number): string {
  const tds = tr.querySelectorAll('td');
  const td = tds[idx] as HTMLTableCellElement | undefined;
  return normalizeText(td?.textContent ?? '');
}

function getTickerFromRow(tr: HTMLTableRowElement, stockNameCellIndex: number): string {
  const td = tr.querySelectorAll('td')[stockNameCellIndex] as HTMLTableCellElement | undefined;
  if (!td) return '';
  const el = td.querySelector('.td-item1');
  const fromEl = normalizeText(el?.textContent ?? '');
  if (fromEl) return fromEl;
  // Fallback: first token
  const t = normalizeText(td.textContent ?? '');
  return t.split(' ')[0] ?? '';
}

function parseTradeRow(
  type: TradeType,
  tr: HTMLTableRowElement,
  hmap: Map<string, number>,
  ctx: Record<string, unknown>
): TradeEvent {
  const dateIdx = hmap.get('成交日');
  const nameIdx = hmap.get('股票名稱');
  const sharesIdx = hmap.get('成交股');
  const cashHeader = type === 'BUY' ? '投入成本' : '交割金額';
  const cashIdx = hmap.get(cashHeader);

  if (dateIdx == null || nameIdx == null || sharesIdx == null || cashIdx == null) {
    throw specError('MISSING_COLUMNS', `Missing required columns for ${type}`, {
      ...ctx,
      availableHeaders: [...hmap.keys()]
    });
  }

  const tradeDate = extractYmdFromCellText(getCellText(tr, dateIdx), ctx);
  const isoDateET = toIsoDateETFromYmdSlash(tradeDate, ctx);
  const ticker = getTickerFromRow(tr, nameIdx);
  if (!ticker) throw specError('PARSE_TICKER', 'Missing ticker', { ...ctx, tradeDate });

  const shares = parseNumberStrict(getCellText(tr, sharesIdx), { ...ctx, field: 'shares' });
  const cash = parseNumberStrict(getCellText(tr, cashIdx), { ...ctx, field: cashHeader });
  const sourceYear = Number(isoDateET.slice(0, 4));

  return { type, tradeDate, isoDateET, ticker, shares, cash, sourceYear };
}

export function parseBuyTable(table: HTMLTableElement, ctx?: Record<string, unknown>): TradeEvent[] {
  const hmap = headerIndexMap(table);
  const rows = Array.from(table.querySelectorAll('tbody tr')) as HTMLTableRowElement[];
  return rows
    .map((tr, i) => parseTradeRow('BUY', tr, hmap, { ...ctx, rowIndex: i }))
    .filter(Boolean);
}