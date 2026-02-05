import { mustQuery } from './dom';
import type { DebugDayRow } from '../core';

const STYLE_ID = 'pvs-debug-table-style';
const TABLE_ID = 'pvs-debug-table';

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
#${TABLE_ID} {
  margin-top: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
}
#${TABLE_ID} .hdr {
  padding: 10px 12px;
  border-bottom: 1px solid #f3f4f6;
  font-weight: 700;
  color: #111827;
}
#${TABLE_ID} .subhdr {
  padding: 8px 12px;
  border-bottom: 1px solid #f3f4f6;
  color: #374151;
  font-size: 12px;
}
#${TABLE_ID} table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
#${TABLE_ID} th, #${TABLE_ID} td {
  border-top: 1px solid #f3f4f6;
  padding: 8px 10px;
  vertical-align: top;
}
#${TABLE_ID} th {
  position: sticky;
  top: 0;
  background: #f9fafb;
  z-index: 1;
  text-align: left;
  color: #111827;
}
#${TABLE_ID} .mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  white-space: pre-wrap;
}
#${TABLE_ID} .tag {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  font-size: 11px;
  margin-right: 6px;
  color: #374151;
  background: #fff;
}
`;
  document.head.appendChild(style);
}

function ensureContainerAfterChart(): HTMLDivElement {
  ensureStyle();
  const existing = document.getElementById(TABLE_ID) as HTMLDivElement | null;
  if (existing) return existing;

  const chart = mustQuery<HTMLDivElement>(document, '#chart');
  const parent = chart.parentElement;
  if (!parent) throw new Error('Chart has no parent element');

  const div = document.createElement('div');
  div.id = TABLE_ID;

  // Insert as sibling element right after chart.
  if (chart.nextSibling) parent.insertBefore(div, chart.nextSibling);
  else parent.appendChild(div);

  return div;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  return n.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

function eventSummary(row: DebugDayRow): string {
  return row.events
    .map((e) => `${e.type} ${e.ticker} shares=${fmt(e.shares)} cash=${fmt(e.cash)} vtiΔ=${fmt(e.vtiDeltaShares)}`)
    .join('\n');
}

function holdingsSummary(row: DebugDayRow): string {
  if (row.holdingsAfter.length === 0) return '(empty)';
  return row.holdingsAfter.map((h) => `${h.ticker}:${fmt(h.shares)}`).join(', ');
}

function pricesSummary(row: DebugDayRow): string {
  if (row.portfolioPricesUsed.length === 0) return '(no holdings)';
  return row.portfolioPricesUsed
    .map((p) => `${p.ticker}=${fmt(p.price)}${p.backfilled ? ` (←${p.usedIsoDateET})` : ''}`)
    .join('\n');
}

export function renderDebugTable(rows: DebugDayRow[]): void {
  const div = ensureContainerAfterChart();
  const note =
    '顯示運算所用資料（事件、日期校正、取價與回補、持倉與估值）。若價格有回補，會標示使用的實際日期。';

  const html = `
    <div class="hdr">資料檢查表（Debug）</div>
    <div class="subhdr">${note}</div>
    <div style="overflow:auto; max-height: 520px;">
      <table>
        <thead>
          <tr>
            <th>dayKey</th>
            <th>resolved</th>
            <th>anchorShifted</th>
            <th>events</th>
            <th>holdingsAfter</th>
            <th>pricesUsed</th>
            <th>VTI price</th>
            <th>portfolioValue</th>
            <th>vtiShares</th>
            <th>vtiValue</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((r) => {
              const vtiPrice = `${fmt(r.vtiPriceUsed.price)}${r.vtiPriceUsed.backfilled ? ` (←${r.vtiPriceUsed.usedIsoDateET})` : ''}`;
              return `
                <tr>
                  <td class="mono">${r.dayKeyIsoDateET}</td>
                  <td class="mono">${r.resolvedIsoDateET}</td>
                  <td>${r.anchorShifted ? '<span class="tag">shifted</span>' : ''}</td>
                  <td class="mono">${eventSummary(r)}</td>
                  <td class="mono">${holdingsSummary(r)}</td>
                  <td class="mono">${pricesSummary(r)}</td>
                  <td class="mono">${vtiPrice}</td>
                  <td class="mono">${fmt(r.portfolioValue)}</td>
                  <td class="mono">${fmt(r.vtiShares)}</td>
                  <td class="mono">${fmt(r.vtiValue)}</td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;

  div.innerHTML = html;
}

