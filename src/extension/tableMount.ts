import type { DebugDayRow, PriceSeries } from '../core';

const STYLE_ID = 'pvs-debug-table-style';
const TABLE_ID = 'pvs-debug-table';
const TOGGLE_ID = 'pvs-price-toggle';
const FETCH_ID = 'pvs-fetch-report';

export type PriceMode = 'close' | 'adjclose';
// Value mode controls chart display (privacy) only.
export type ValueMode = 'amount' | 'percent' | 'excess';

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
#${TOGGLE_ID} {
  display: block;
  margin: 10px 0 0 0;
}
#${TOGGLE_ID} .row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 6px 0;
}
#${TOGGLE_ID} .btn {
  border: 1px solid #e5e7eb;
  background: #ffffff;
  border-radius: 10px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 12px;
  color: #111827;
}
#${TOGGLE_ID} .btn:hover {
  background: #f9fafb;
}
#${TOGGLE_ID} .btn.active {
  border-color: #111827;
  background: #ffffff;
  color: #111827;
  box-shadow: inset 0 0 0 1px #111827;
}
#${TOGGLE_ID} .hint {
  font-size: 12px;
  color: #6b7280;
}
`;
  document.head.appendChild(style);
}

function ensureContainerAfterChart(): HTMLDivElement {
  ensureStyle();
  const existing = document.getElementById(TABLE_ID) as HTMLDivElement | null;
  const chart = document.getElementById('chart') as HTMLDivElement | null;
  const tagArea = document.getElementById('TagSelectArea') as HTMLElement | null;
  if (existing) {
    // If chart exists, ensure the table is placed right after chart.
    if (chart && existing.parentElement) {
      const parent = chart.parentElement;
      if (parent && existing !== chart.nextSibling) {
        if (chart.nextSibling) parent.insertBefore(existing, chart.nextSibling);
        else parent.appendChild(existing);
      }
    }
    return existing;
  }

  // If chart isn't mounted yet, attach to TagSelectArea as a placeholder;
  // later calls will reposition it after chart.
  if (!chart) {
    const host = tagArea ?? document.body;
    const div = document.createElement('div');
    div.id = TABLE_ID;
    host.appendChild(div);
    return div;
  }

  const parent = chart.parentElement;
  if (!parent) throw new Error('Chart has no parent element');

  const div = document.createElement('div');
  div.id = TABLE_ID;

  // Insert as sibling element right after chart.
  if (chart.nextSibling) parent.insertBefore(div, chart.nextSibling);
  else parent.appendChild(div);

  return div;
}

function ensureToggleBeforeChart(): HTMLDivElement {
  ensureStyle();
  const existing = document.getElementById(TOGGLE_ID) as HTMLDivElement | null;
  const chart = document.getElementById('chart') as HTMLDivElement | null;
  const tagArea = document.getElementById('TagSelectArea') as HTMLElement | null;

  // If already exists, ensure it is placed before chart when chart is available.
  if (existing) {
    if (chart && existing.parentElement) {
      const parent = chart.parentElement;
      if (parent && existing.nextSibling !== chart) {
        parent.insertBefore(existing, chart);
      }
    }
    return existing;
  }

  // If chart isn't mounted yet, attach to TagSelectArea as a placeholder;
  // later calls will reposition it before chart.
  if (!chart) {
    const host = tagArea ?? document.body;
    const div = document.createElement('div');
    div.id = TOGGLE_ID;
    // Prefer inserting near the top for visibility.
    if (host.firstChild) host.insertBefore(div, host.firstChild);
    else host.appendChild(div);
    return div;
  }

  const parent = chart.parentElement;
  if (!parent) throw new Error('Chart has no parent element');
  const div = document.createElement('div');
  div.id = TOGGLE_ID;
  parent.insertBefore(div, chart);
  return div;
}

function ensureToggleRows(): { root: HTMLDivElement; valueRow: HTMLDivElement; priceRow: HTMLDivElement } {
  const root = ensureToggleBeforeChart();
  let valueRow = root.querySelector<HTMLDivElement>('div[data-row="value"]') ?? null;
  let priceRow = root.querySelector<HTMLDivElement>('div[data-row="price"]') ?? null;

  if (!valueRow) {
    valueRow = document.createElement('div');
    valueRow.className = 'row';
    valueRow.setAttribute('data-row', 'value');
    root.appendChild(valueRow);
  }
  if (!priceRow) {
    priceRow = document.createElement('div');
    priceRow.className = 'row';
    priceRow.setAttribute('data-row', 'price');
    root.appendChild(priceRow);
  }

  // Enforce order: value row first, then price row.
  if (root.firstChild !== valueRow) root.insertBefore(valueRow, root.firstChild);
  if (valueRow.nextSibling !== priceRow) root.insertBefore(priceRow, valueRow.nextSibling);

  return { root, valueRow, priceRow };
}

function ensureFetchReportAfterToggle(): HTMLDivElement {
  ensureStyle();
  const existing = document.getElementById(FETCH_ID) as HTMLDivElement | null;
  const toggle = document.getElementById(TOGGLE_ID) as HTMLDivElement | null;
  const chart = document.getElementById('chart') as HTMLDivElement | null;
  const tagArea = document.getElementById('TagSelectArea') as HTMLElement | null;

  if (existing) {
    if (toggle && toggle.parentElement && existing.parentElement && toggle.nextSibling !== existing) {
      toggle.parentElement.insertBefore(existing, toggle.nextSibling);
    }
    return existing;
  }

  const host = (toggle?.parentElement ?? chart?.parentElement ?? tagArea ?? document.body) as HTMLElement;
  const div = document.createElement('div');
  div.id = FETCH_ID;
  div.style.marginTop = '8px';
  if (toggle && toggle.parentElement) toggle.parentElement.insertBefore(div, toggle.nextSibling);
  else host.appendChild(div);
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

function lookup(series: PriceSeries | undefined, isoDateET: string): number | null {
  if (!series) return null;
  const v = series.get(isoDateET);
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function renderPriceModeToggle(mode: PriceMode, onChange: (mode: PriceMode) => void): void {
  const { priceRow } = ensureToggleRows();
  priceRow.innerHTML = `
    <button class="btn ${mode === 'close' ? 'active' : ''}" data-mode="close" type="button">Close</button>
    <button class="btn ${mode === 'adjclose' ? 'active' : ''}" data-mode="adjclose" type="button">Adj Close</button>
    <span class="hint">估值口徑（不會重抓資料，僅重算/更新圖表與表格）</span>
  `;
  priceRow.querySelectorAll<HTMLButtonElement>('button[data-mode]').forEach((b) => {
    b.onclick = () => {
      const m = b.getAttribute('data-mode') as PriceMode | null;
      if (!m) return;
      onChange(m);
    };
  });
}

export function renderValueModeToggle(mode: ValueMode, onChange: (mode: ValueMode) => void): void {
  const { valueRow } = ensureToggleRows();
  valueRow.innerHTML = `
    <button class="btn" data-vmode="excess" type="button" title="超額績效% = (投資組合市值 / VTI 市值 - 1) × 100%（相對 VTI 的超額績效%）">超額績效%</button>
    <button class="btn" data-vmode="percent" type="button" title="投入報酬率% = (市值 / 累積投入金額 - 1) × 100%（投資組合與 VTI 皆以各自市值計）">投入報酬率%</button>
    <button class="btn" data-vmode="amount" type="button" title="顯示投資組合與 VTI 的市值（金額）">市值</button>
    <span class="hint" data-vdesc="1"></span>
  `;

  valueRow.querySelectorAll<HTMLButtonElement>('button[data-vmode]').forEach((b) => {
    const m = b.getAttribute('data-vmode') as ValueMode | null;
    if (!m) return;
    b.classList.toggle('active', m === mode);
    b.onclick = () => onChange(m);
  });

  const desc = valueRow.querySelector('span[data-vdesc="1"]') as HTMLSpanElement | null;
  if (desc) {
    desc.textContent =
      mode === 'amount'
        ? '說明：顯示投資組合與 VTI 的市值（金額）'
        : mode === 'percent'
          ? '說明：投入報酬率% = (市值 / 累積投入金額 - 1) × 100%（投資組合與 VTI 皆以各自市值計）'
          : '說明：超額績效% = (投資組合市值 / VTI 市值 - 1) × 100%（相對 VTI 的超額績效%）';
  }
}

export function renderDebugTable(
  rows: DebugDayRow[],
  opts: {
    mode: PriceMode;
    closeSeriesByTicker: Map<string, PriceSeries>;
    adjSeriesByTicker: Map<string, PriceSeries>;
    anchorTicker?: string;
    fetchReport?: {
      startedAt: number;
      finishedAt?: number;
      failedTickers: { ticker: string; reason: string }[];
      logs: {
        ticker: string;
        year: number;
        endYear?: number;
        attempt: number;
        maxAttempts: number;
        outcome: 'ok' | 'retry' | 'fail';
        error?: { kind: string; message: string; status?: number; url?: string };
      }[];
    };
  }
): void {
  const div = ensureContainerAfterChart();
  const anchorTicker = opts.anchorTicker ?? 'VTI';
  const modeLabel = opts.mode === 'close' ? 'Close' : 'Adj Close';
  const note =
    `顯示運算所用資料（事件、日期校正、取價與回補、持倉與估值）。比較規則：BUY-only（SELL 不納入比較）。目前估值口徑：${modeLabel}。若價格有回補，會標示使用的實際日期。`;

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
            <th>dayCashTotal</th>
            <th>vtiΔTotal</th>
            <th>holdingsAfter</th>
            <th>pricesUsed (close / adj)</th>
            <th>${anchorTicker} price (close / adj)</th>
            <th>portfolioValue</th>
            <th>vtiShares</th>
            <th>vtiValue</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((r) => {
              const usedVtiIso = r.vtiPriceUsed.usedIsoDateET;
              const vtiClose = lookup(opts.closeSeriesByTicker.get(anchorTicker), usedVtiIso);
              const vtiAdj = lookup(opts.adjSeriesByTicker.get(anchorTicker), usedVtiIso);
              const vtiPrice = `close=${vtiClose == null ? '—' : fmt(vtiClose)} / adj=${vtiAdj == null ? '—' : fmt(vtiAdj)}${
                r.vtiPriceUsed.backfilled ? ` (←${usedVtiIso})` : ''
              }`;

              const priceLines = r.portfolioPricesUsed
                .map((p) => {
                  const iso = p.usedIsoDateET;
                  const c = lookup(opts.closeSeriesByTicker.get(p.ticker), iso);
                  const a = lookup(opts.adjSeriesByTicker.get(p.ticker), iso);
                  return `${p.ticker} close=${c == null ? '—' : fmt(c)} / adj=${a == null ? '—' : fmt(a)}${
                    p.backfilled ? ` (←${iso})` : ''
                  }`;
                })
                .join('\n');
              return `
                <tr>
                  <td class="mono">${r.dayKeyIsoDateET}</td>
                  <td class="mono">${r.resolvedIsoDateET}</td>
                  <td>${r.anchorShifted ? '<span class="tag">shifted</span>' : ''}</td>
                  <td class="mono">${eventSummary(r)}</td>
                  <td class="mono">${fmt(r.dayCashTotal)}</td>
                  <td class="mono">${fmt(r.vtiDeltaSharesTotal)}</td>
                  <td class="mono">${holdingsSummary(r)}</td>
                  <td class="mono">${priceLines || '(no holdings)'}</td>
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

export function renderPriceFetchReport(report: {
  startedAt: number;
  finishedAt?: number;
  failedTickers: { ticker: string; reason: string }[];
  logs: {
    ticker: string;
    year: number;
    endYear?: number;
    attempt: number;
    maxAttempts: number;
    outcome: 'ok' | 'retry' | 'fail';
    error?: { kind: string; message: string; status?: number; url?: string };
  }[];
}): void {
  const div = ensureFetchReportAfterToggle();
  const durMs = report.finishedAt ? report.finishedAt - report.startedAt : null;
  const failed = report.failedTickers ?? [];
  const headline = `抓價報告：${failed.length === 0 ? '全部成功' : `失敗 ${failed.length} 檔`}${
    durMs == null ? '' : `（${(durMs / 1000).toFixed(1)}s）`
  }`;

  const failedLines =
    failed.length === 0 ? '' : failed.map((f) => `- ${f.ticker}: ${f.reason}`).join('\n');

  // Keep it compact: show only fail/retry logs (ok is usually noisy).
  const interesting = (report.logs ?? []).filter((l) => l.outcome !== 'ok');
  const logLines =
    interesting.length === 0
      ? ''
      : interesting
          .slice(-50)
          .map((l) => {
            const e = l.error;
            const code = e?.kind ? `${e.kind}${e.status ? `(${e.status})` : ''}` : 'error';
            const yearLabel = l.endYear != null ? `${l.year}-${l.endYear}` : String(l.year);
            return `- ${l.ticker} ${yearLabel} attempt ${l.attempt}/${l.maxAttempts} ${l.outcome}: ${code} ${e?.message ?? ''}`.trim();
          })
          .join('\n');

  div.innerHTML = `
    <div style="border:1px solid #e5e7eb; border-radius:12px; padding:10px 12px; background:#fff;">
      <div style="font-weight:700; color:#111827; margin-bottom:6px;">${headline}</div>
      ${
        failedLines
          ? `<div class="mono" style="white-space:pre-wrap; color:#991b1b; margin-bottom:6px;">${failedLines}</div>`
          : `<div style="color:#374151; font-size:12px; margin-bottom:6px;">沒有偵測到失敗 ticker。</div>`
      }
      ${
        logLines
          ? `<div class="mono" style="white-space:pre-wrap; color:#374151; max-height:160px; overflow:auto;">${logLines}</div>`
          : ''
      }
    </div>
  `;
}
