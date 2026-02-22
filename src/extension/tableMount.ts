import type { DebugDayRow, PriceSeries } from '../core';

const STYLE_ID = 'pvs-debug-table-style';
const TABLE_ID = 'pvs-debug-table';
const TOGGLE_ID = 'pvs-price-toggle';
const FETCH_ID = 'pvs-fetch-report';
const RULES_ID = 'pvs-chart-rules';
/** Wrapper for all extension UI under #TagSelectArea (flex column, gap). */
export const WRAPPER_ID = 'pvs-chart-block';

const ACCORDION_ID = 'pvs-accordion';
const ACCORDION_BODY_ID = 'pvs-accordion-body';
const ACCORDION_LOADER_ID = 'pvs-accordion-loader';
const ACCORDION_STATUS_ID = 'pvs-accordion-status';

const RULES_DETAILS_ID = 'pvs-rules-details';
const FETCH_DETAILS_ID = 'pvs-fetch-details';
const DEBUG_DETAILS_ID = 'pvs-debug-details';

const BLOCK_ORDER = [TOGGLE_ID, 'chart', RULES_DETAILS_ID, FETCH_DETAILS_ID, DEBUG_DETAILS_ID] as const;

/** When set (e.g. accordion body), chart block is inserted here instead of TagSelectArea. */
let chartBlockParent: HTMLElement | null = null;

export function setChartBlockParent(el: HTMLElement | null): void {
  chartBlockParent = el;
}

/** 主色，用於按鈕、標題等，與網站配色一致 */
const PRIMARY_COLOR = '#3f5372';

export type PriceMode = 'close' | 'adjclose';
// Value mode controls chart display (privacy) only.
export type ValueMode = 'amount' | 'percent' | 'excess';

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
#${TABLE_ID} {
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  background: #fff;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
}
#${TABLE_ID} .hdr {
  padding: 10px 12px;
  border-bottom: 1px solid #f3f4f6;
  font-weight: 700;
  color: ${PRIMARY_COLOR};
}
#${TABLE_ID} .subhdr {
  padding: 8px 12px;
  border-bottom: 1px solid #f3f4f6;
  color: #374151;
  font-size: 12px;
}
#${TABLE_ID} .subhdr ul {
  margin: 0;
  padding-left: 18px;
}
#${TABLE_ID} .subhdr li + li {
  margin-top: 2px;
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
  display: flex;
  flex-direction: column;
  gap: 8px;
}
#${TOGGLE_ID} .row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
#${TOGGLE_ID} .btn-group {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  border-radius: 4px;
  border: solid 1px #d9dde3;
  padding: 8px;
}
#${TOGGLE_ID} .btn-group .btn {
  border-radius: 4px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 12px;
  color: ${PRIMARY_COLOR};
}
#${TOGGLE_ID} .btn-group .btn:hover {
  background: #f5f6f8;
}
#${TOGGLE_ID} .btn-group .btn.active {
  border-color: ${PRIMARY_COLOR};
  background: ${PRIMARY_COLOR};
  color: #fff;
}
#${TOGGLE_ID} .hint {
  font-size: 12px;
  color: #6b7280;
}
#${FETCH_ID} details.summary-card {
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  background: #fff;
}
#${FETCH_ID} details.summary-card > summary {
  list-style: none;
  cursor: pointer;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: ${PRIMARY_COLOR};
  font-weight: 700;
}
#${FETCH_ID} details.summary-card > summary::-webkit-details-marker {
  display: none;
}
#${FETCH_ID} .summary-hint {
  font-size: 12px;
  color: #6b7280;
  font-weight: 400;
}
#${TABLE_ID} .summary-body,
#${FETCH_ID} .summary-body {
  border-top: 1px solid #f3f4f6;
}
#${RULES_ID} {
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  background: #fff;
  padding: 8px 10px;
  color: ${PRIMARY_COLOR};
  font-size: 12px;
}
#${RULES_ID} ul {
  margin: 0;
  padding-left: 18px;
}
#${RULES_ID} li + li {
  margin-top: 2px;
}
#${WRAPPER_ID} {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0px;
}
#${ACCORDION_ID} {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin: 8px 0;
  padding: 0 8px;
}
#${ACCORDION_ID} summary {
  padding: 10px 12px;
  cursor: pointer;
  font-weight: 700;
  color: ${PRIMARY_COLOR};
  list-style: none;
  user-select: none;
}
#${ACCORDION_ID} summary::-webkit-details-marker { display: none; }
#${ACCORDION_LOADER_ID} {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  color: #6b7280;
  font-size: 14px;
}
#${ACCORDION_LOADER_ID} .pvs-spin {
  width: 18px;
  height: 18px;
  border: 2px solid #e5e7eb;
  border-top-color: ${PRIMARY_COLOR};
  border-radius: 999px;
  animation: pvs-spin 0.9s linear infinite;
}
@keyframes pvs-spin { to { transform: rotate(360deg); } }
#${ACCORDION_STATUS_ID} {
  margin-top: 8px;
  font-size: 13px;
  color: #374151;
  line-height: 1.5;
  white-space: pre-wrap;
}
#${ACCORDION_STATUS_ID}.pvs-status-error {
  color: #991b1b;
}
`;
  document.head.appendChild(style);
}

function getTagArea(): HTMLElement | null {
  return document.getElementById('TagSelectArea') as HTMLElement | null;
}

function ensurePvsWrapper(): HTMLDivElement {
  const tagArea = getTagArea();
  let wrapper = document.getElementById(WRAPPER_ID) as HTMLDivElement | null;
  if (wrapper) {
    orderWrapperChildren(wrapper);
    return wrapper;
  }
  if (!tagArea) throw new Error('TagSelectArea not found');
  wrapper = document.createElement('div');
  wrapper.id = WRAPPER_ID;
  const parent = chartBlockParent ?? tagArea;
  if (parent !== tagArea) {
    parent.appendChild(wrapper);
  } else {
    const children = Array.from(tagArea.children);
    const insertBefore = children[1] ?? null;
    if (insertBefore) tagArea.insertBefore(wrapper, insertBefore);
    else tagArea.appendChild(wrapper);
  }
  for (const id of BLOCK_ORDER) {
    const el = document.getElementById(id);
    if (el && (el.parentElement === tagArea || el.parentElement?.id === ACCORDION_BODY_ID)) wrapper.appendChild(el);
  }
  return wrapper;
}

function orderWrapperChildren(wrapper: HTMLElement): void {
  for (const id of BLOCK_ORDER) {
    const el = document.getElementById(id);
    if (el && el.parentElement === wrapper) wrapper.appendChild(el);
  }
}

export type AccordionRef = { details: HTMLDetailsElement; body: HTMLDivElement };

export function mountAccordion(opts?: { onUpdate?: () => void }): AccordionRef {
  ensureStyle();
  const tagArea = getTagArea();
  if (!tagArea) throw new Error('TagSelectArea not found');
  let details = document.getElementById(ACCORDION_ID) as HTMLDetailsElement | null;
  if (details) {
    const body = document.getElementById(ACCORDION_BODY_ID) as HTMLDivElement;
    return { details, body: body! };
  }
  details = document.createElement('details');
  details.id = ACCORDION_ID;
  const summary = document.createElement('summary');
  summary.style.display = 'flex';
  summary.style.alignItems = 'center';
  summary.style.justifyContent = 'space-between';
  summary.style.gap = '8px';
  const title = document.createElement('span');
  title.textContent = '圖表與分析';
  summary.appendChild(title);
  if (opts?.onUpdate) {
    const updateBtn = document.createElement('button');
    updateBtn.type = 'button';
    updateBtn.textContent = '更新資料';
    updateBtn.style.fontSize = '12px';
    updateBtn.style.fontWeight = '400';
    updateBtn.style.cursor = 'pointer';
    updateBtn.style.border = '1px solid #d9dde3';
    updateBtn.style.borderRadius = '4px';
    updateBtn.style.padding = '4px 8px';
    updateBtn.style.background = '#fff';
    updateBtn.style.color = PRIMARY_COLOR;
    updateBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      opts.onUpdate!();
    };
    summary.appendChild(updateBtn);
  }
  details.appendChild(summary);
  const body = document.createElement('div');
  body.id = ACCORDION_BODY_ID;
  body.style.padding = '0 12px';
  details.appendChild(body);
  const children = Array.from(tagArea.children);
  const insertBefore = children[1] ?? null;
  if (insertBefore) tagArea.insertBefore(details, insertBefore);
  else tagArea.appendChild(details);
  return { details, body };
}

export function setAccordionBodyLoading(show: boolean): void {
  const body = document.getElementById(ACCORDION_BODY_ID) as HTMLDivElement | null;
  if (!body) return;
  const loader = document.getElementById(ACCORDION_LOADER_ID);
  const statusEl = document.getElementById(ACCORDION_STATUS_ID);
  if (show) {
    loader?.remove();
    statusEl?.remove();
    const loaderDiv = document.createElement('div');
    loaderDiv.id = ACCORDION_LOADER_ID;
    loaderDiv.innerHTML = '<div class="pvs-spin"></div><span>資料處理中</span>';
    body.appendChild(loaderDiv);
    const statusDiv = document.createElement('div');
    statusDiv.id = ACCORDION_STATUS_ID;
    body.appendChild(statusDiv);
  } else {
    loader?.remove();
    statusEl?.remove();
  }
}

export function setAccordionStatusText(text: string): void {
  const el = document.getElementById(ACCORDION_STATUS_ID);
  if (!el) return;
  el.textContent = text;
  el.classList.remove('pvs-status-error');
}

export function setAccordionStatusError(text: string): void {
  const body = document.getElementById(ACCORDION_BODY_ID) as HTMLDivElement | null;
  if (!body) return;
  document.getElementById(ACCORDION_LOADER_ID)?.remove();
  let el = document.getElementById(ACCORDION_STATUS_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = ACCORDION_STATUS_ID;
    body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('pvs-status-error');
}

export function isAccordionOpen(): boolean {
  const details = document.getElementById(ACCORDION_ID) as HTMLDetailsElement | null;
  return details?.open ?? false;
}

export function openAccordion(open: boolean): void {
  const details = document.getElementById(ACCORDION_ID) as HTMLDetailsElement | null;
  if (details) details.open = open;
}

export function setAccordionExpandCallback(cb: (open: boolean) => void): void {
  const details = document.getElementById(ACCORDION_ID) as HTMLDetailsElement | null;
  if (!details) return;
  details.addEventListener('toggle', () => cb(details.open));
}

function ensureDetailsInWrapper(
  wrapper: HTMLElement,
  detailsId: string,
  summaryText: string,
  contentId: string
): HTMLDivElement {
  let details = document.getElementById(detailsId) as HTMLDetailsElement | null;
  if (!details) {
    details = document.createElement('details');
    details.id = detailsId;
    const sum = document.createElement('summary');
    sum.textContent = summaryText;
    details.appendChild(sum);
    wrapper.appendChild(details);
  }
  let content = document.getElementById(contentId) as HTMLDivElement | null;
  if (!content) {
    content = document.createElement('div');
    content.id = contentId;
    details.appendChild(content);
  } else if (content.parentElement !== details) {
    details.appendChild(content);
  }
  orderWrapperChildren(wrapper);
  return content;
}

function ensureContainerAfterChart(): HTMLDivElement {
  ensureStyle();
  const wrapper = ensurePvsWrapper();
  return ensureDetailsInWrapper(wrapper, DEBUG_DETAILS_ID, '進階資料檢查（Debug）', TABLE_ID);
}

function ensureToggleBeforeChart(): HTMLDivElement {
  ensureStyle();
  const wrapper = ensurePvsWrapper();
  const existing = document.getElementById(TOGGLE_ID) as HTMLDivElement | null;
  if (existing) {
    if (existing.parentElement !== wrapper) wrapper.appendChild(existing);
    orderWrapperChildren(wrapper);
    return existing;
  }
  const div = document.createElement('div');
  div.id = TOGGLE_ID;
  wrapper.appendChild(div);
  orderWrapperChildren(wrapper);
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
  const wrapper = ensurePvsWrapper();
  return ensureDetailsInWrapper(wrapper, FETCH_DETAILS_ID, '抓價報告', FETCH_ID);
}

function ensureRulesBetweenToggleAndChart(): HTMLDivElement {
  ensureStyle();
  const wrapper = ensurePvsWrapper();
  return ensureDetailsInWrapper(wrapper, RULES_DETAILS_ID, '圖表呈現規則', RULES_ID);
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  return n.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

function eventSummary(row: DebugDayRow): string {
  return row.events
    .map((e) =>
      [
        `${e.type} ${e.ticker}`,
        `•\u00A0shares=${fmt(e.shares)}`,
        `•\u00A0cash=${fmt(e.cash)}`,
        `•\u00A0vtiΔ=${fmt(e.vtiDeltaShares)}`
      ].join('\n')
    )
    .join('\n');
}

function splitAdjSummary(row: DebugDayRow): string {
  const lines = row.events
    .map((e) => {
      const factor = e.splitFactorApplied;
      const raw = e.splitAdjustedFromShares;
      if (typeof factor !== 'number' || !Number.isFinite(factor) || factor === 1) return '';
      if (typeof raw !== 'number' || !Number.isFinite(raw)) return '';
      const chain =
        Array.isArray(e.splitAppliedChain) && e.splitAppliedChain.length > 0
          ? ` [${e.splitAppliedChain.join(' -> ')}]`
          : '';
      return `${e.ticker} raw=${fmt(raw)} × ${fmt(factor)} => ${fmt(e.shares)}${chain}`;
    })
    .filter((x) => x.length > 0);
  return lines.length > 0 ? lines.join('\n') : '(none)';
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
    <div class="btn-group">
        <button class="btn ${mode === 'close' ? 'active' : ''}" data-mode="close" type="button">Close</button>
        <button class="btn ${mode === 'adjclose' ? 'active' : ''}" data-mode="adjclose" type="button">Adj Close</button>
    </div>
    <span class="hint">市值計算口徑（不會重抓資料，僅重算/更新圖表與表格）</span>
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
    <div class="btn-group">
        <button class="btn" data-vmode="excess" type="button" title="超額績效% = (投資組合市值 / VTI 市值 - 1) × 100%（相對 VTI 的超額績效%）">超額績效%</button>
        <button class="btn" data-vmode="percent" type="button" title="投入報酬率% = (市值 / 累積投入金額 - 1) × 100%（投資組合與 VTI 皆以各自市值計）">投入報酬率%</button>
        <button class="btn" data-vmode="amount" type="button" title="顯示投資組合與 VTI 的市值（金額）">市值</button>
    </div>
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

export function renderChartRules(): void {
  const div = ensureRulesBetweenToggleAndChart();
  const items = [
    '比較規則：BUY-only（SELL 不納入比較）',
    '拆股還原規則：僅套用 splitDate > tradeDate（同日不套用）',
    '若價格有回補，會標示使用的實際日期'
  ];
  div.innerHTML = `<ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul>`;
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
  const noteItems = [
    `目前市值計算口徑：${modeLabel}`,
    '比較規則：BUY-only（SELL 不納入比較）',
    '拆股還原規則：僅套用 splitDate > tradeDate（同日不套用）',
    '若價格有回補，會標示使用的實際日期',
  ];

  const html = `
    <div class="summary-body">
      <div class="subhdr">
        <ul>${noteItems.map((x) => `<li>${x}</li>`).join('')}</ul>
      </div>
      <div style="overflow:auto; max-height: 520px;">
        <table>
            <thead>
              <tr>
                <th>事件日期</th>
                <th>實際計算日期</th>
                <th>日期校正</th>
                <th>當日事件</th>
                <th>拆股還原</th>
                <th>當日現金流</th>
                <th>${anchorTicker} 股數變化</th>
                <th>持倉（事件後）</th>
                <th>標的價格（收盤 & 還原）</th>
                <th>${anchorTicker} 價格（收盤 & 還原）</th>
                <th>投資組合市值</th>
                <th>${anchorTicker} 持有股數</th>
                <th>${anchorTicker} 市值</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map((r) => {
              const usedVtiIso = r.vtiPriceUsed.usedIsoDateET;
              const vtiClose = lookup(opts.closeSeriesByTicker.get(anchorTicker), usedVtiIso);
              const vtiAdj = lookup(opts.adjSeriesByTicker.get(anchorTicker), usedVtiIso);
              const vtiPrice = [
                `•\u00A0close=${vtiClose == null ? '—' : fmt(vtiClose)}`,
                `•\u00A0adj=${vtiAdj == null ? '—' : fmt(vtiAdj)}`,
                r.vtiPriceUsed.backfilled ? `•\u00A0回補日期：${usedVtiIso}` : ''
              ]
                .filter((x) => x.length > 0)
                .join('\n');

              const priceLines = r.portfolioPricesUsed
                .map((p) => {
                  const iso = p.usedIsoDateET;
                  const c = lookup(opts.closeSeriesByTicker.get(p.ticker), iso);
                  const a = lookup(opts.adjSeriesByTicker.get(p.ticker), iso);
                  return [
                    `${p.ticker}`,
                    `•\u00A0close=${c == null ? '—' : fmt(c)}`,
                    `•\u00A0adj=${a == null ? '—' : fmt(a)}`,
                    p.backfilled ? `•\u00A0回補日期：${iso}` : ''
                  ]
                    .filter((x) => x.length > 0)
                    .join('\n');
                })
                .join('\n');
              return `
                <tr>
                  <td class="mono">${r.dayKeyIsoDateET}</td>
                  <td class="mono">${r.resolvedIsoDateET}</td>
                  <td>${r.anchorShifted ? '<span class="tag">shifted</span>' : ''}</td>
                  <td class="mono">${eventSummary(r)}</td>
                  <td class="mono">${splitAdjSummary(r)}</td>
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
  const headline = `${failed.length === 0 ? '資料同步完成' : '資料同步完成（部分項目需留意）'}${
    durMs == null ? '' : `（${(durMs / 1000).toFixed(1)}s）`
  }`;
  const summaryHint = failed.length === 0 ? '本次未偵測到異常。查看詳情' : `其中 ${failed.length} 檔抓價異常。查看詳情`;

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
    <details class="summary-card">
      <summary>
        <span>${headline}</span>
        <span class="summary-hint">${summaryHint}</span>
      </summary>
      <div class="summary-body" style="padding:10px 12px;">
        ${
          failedLines
            ? `<div class="mono" style="white-space:pre-wrap; color:#991b1b; margin-bottom:6px;">${failedLines}</div>`
            : `<div style="color:#374151; font-size:12px; margin-bottom:6px;">本次未偵測到異常，已使用可用資料完成計算。</div>`
        }
        ${
          logLines
            ? `<div class="mono" style="white-space:pre-wrap; color:#374151; max-height:160px; overflow:auto;">${logLines}</div>`
            : ''
        }
      </div>
    </details>
  `;
}
