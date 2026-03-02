import type { DebugDayRow, PriceSeries } from '../core';
import { formatNumber, formatPercent } from '../core/number';

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
const FETCH_STATUS_ICON_ID = 'pvs-fetch-status-icon';

const RULES_DETAILS_ID = 'pvs-rules-details';
const FETCH_DETAILS_ID = 'pvs-fetch-details';

const YEARLY_SUMMARY_ID = 'pvs-yearly-summary';
const BLOCK_ORDER = [TOGGLE_ID, 'chart', YEARLY_SUMMARY_ID, RULES_DETAILS_ID, FETCH_DETAILS_ID] as const;

const MODAL_OVERLAY_ID = 'pvs-daily-detail-modal-overlay';
const MODAL_PANEL_ID = 'pvs-daily-detail-modal-panel';
const DAILY_DETAIL_BTN_ID = 'pvs-daily-detail-btn';

/** When set (e.g. accordion body), chart block is inserted here instead of TagSelectArea. */
let chartBlockParent: HTMLElement | null = null;

export function setChartBlockParent(el: HTMLElement | null): void {
    chartBlockParent = el;
}

/** 主色，用於按鈕、標題等，與網站配色一致 */
export const PRIMARY_COLOR = '#3f5372';

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
#${TOGGLE_ID} .pvs-hint-info {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: help;
    color: #6b7280;
    flex-shrink: 0;
    padding: 8px;
}
#${TOGGLE_ID} .pvs-hint-info svg {
    width: 14px;
    height: 14px;
}
#${FETCH_ID} .fetch-report-headline {
    padding: 10px 24px 0;
    font-size: 12px;
    font-weight: 600;
    color: ${PRIMARY_COLOR};
}
#${TABLE_ID} .summary-body,
#${FETCH_ID} .summary-body {
    border-top: 1px solid #f3f4f6;
}
#${ACCORDION_ID} .pvs-accordion-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
}
#${ACCORDION_ID} .pvs-accordion-title-left {
    display: flex;
    align-items: center;
    gap: 6px;
}
#${ACCORDION_ID} .pvs-accordion-title-right {
    display: flex;
    align-items: center;
    gap: 6px;
}
#${ACCORDION_ID} .${FETCH_STATUS_ICON_ID} {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border-radius: 4px;
    cursor: pointer;
    color: ${PRIMARY_COLOR};
    flex-shrink: 0;
}
#${ACCORDION_ID} .${FETCH_STATUS_ICON_ID}:hover {
    background: #f5f6f8;
}
#${ACCORDION_ID} .${FETCH_STATUS_ICON_ID}.pvs-fetch-error {
    color: #c43826;
    border-color: #c43826;
}
#${ACCORDION_ID} .${FETCH_STATUS_ICON_ID} svg {
    width: 14px;
    height: 14px;
    stroke: currentColor;
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
#${ACCORDION_ID} .${FETCH_STATUS_ICON_ID},
#${ACCORDION_ID} .pvs-header-icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border-radius: 4px;
    cursor: pointer;
    color: ${PRIMARY_COLOR};
    flex-shrink: 0;
    border: none;
    background: transparent;
}
#${ACCORDION_ID} .${FETCH_STATUS_ICON_ID}:hover,
#${ACCORDION_ID} .pvs-header-icon-btn:hover {
    background: #f5f6f8;
}
#${ACCORDION_ID} .${FETCH_STATUS_ICON_ID}.pvs-fetch-error {
    color: #c43826;
    border-color: #c43826;
}
#${ACCORDION_ID} .${FETCH_STATUS_ICON_ID} svg,
#${ACCORDION_ID} .pvs-header-icon-btn svg {
    width: 14px;
    height: 14px;
    stroke: currentColor;
}
#${ACCORDION_ID} {
    border: 1px solid #d9dde3;
    border-radius: 8px;
    margin: 40px 0 0;
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
#${MODAL_OVERLAY_ID} {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    box-sizing: border-box;
}
#${MODAL_PANEL_ID} {
    background: #fff;
    border-radius: 8px;
    max-width: 96vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
}
#${MODAL_PANEL_ID} .pvs-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid #e5e7eb;
    flex-shrink: 0;
    font-weight: 700;
    color: ${PRIMARY_COLOR};
}
#${MODAL_PANEL_ID} .pvs-modal-close {
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 4px;
    color: #6b7280;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
#${MODAL_PANEL_ID} .pvs-modal-close:hover {
    background: #f3f4f6;
    color: #111827;
}
#${MODAL_PANEL_ID} .pvs-modal-body {
    overflow: auto;
    padding: 0;
    flex: 1;
    min-height: 0;
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

let dailyDetailDataProvider: (() => DailyDetailData | null) | null = null;

export type DailyDetailData = {
  rows: DebugDayRow[];
  mode: PriceMode;
  closeSeriesByTicker: Map<string, PriceSeries>;
  adjSeriesByTicker: Map<string, PriceSeries>;
  anchorTicker?: string;
};

export function setDailyDetailDataProvider(provider: () => DailyDetailData | null): void {
  dailyDetailDataProvider = provider;
}

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
    const titleRow = document.createElement('div');
    titleRow.className = 'pvs-accordion-title-row';
    const leftGroup = document.createElement('div');
    leftGroup.className = 'pvs-accordion-title-left';
    const title = document.createElement('span');
    title.textContent = '圖表與分析';
    leftGroup.appendChild(title);
    const statusIcon = document.createElement('button');
    statusIcon.type = 'button';
    statusIcon.id = FETCH_STATUS_ICON_ID;
    statusIcon.className = FETCH_STATUS_ICON_ID;
    statusIcon.setAttribute('aria-label', '抓價報告');
    statusIcon.title = '抓價報告';
    statusIcon.style.display = 'none';
    statusIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y1="13"/><line x1="16" y1="17" x2="8" y1="17"/><line x1="10" y1="9" x2="8" y1="9"/></svg>`;
    leftGroup.appendChild(statusIcon);
    const dailyDetailBtn = document.createElement('button');
    dailyDetailBtn.type = 'button';
    dailyDetailBtn.id = DAILY_DETAIL_BTN_ID;
    dailyDetailBtn.className = 'pvs-header-icon-btn';
    dailyDetailBtn.setAttribute('aria-label', '每日明細');
    dailyDetailBtn.title = '每日明細：查看每個交易日的持倉、市值與計算依據';
    dailyDetailBtn.style.display = 'none';
    dailyDetailBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`;
    dailyDetailBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const data = dailyDetailDataProvider?.() ?? null;
      if (!data) {
        alert('請先完成計算後再查看每日明細。');
        return;
      }
      openDailyDetailModal(data);
    };
    leftGroup.appendChild(dailyDetailBtn);
    titleRow.appendChild(leftGroup);
    const rightGroup = document.createElement('div');
    rightGroup.className = 'pvs-accordion-title-right';
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
        rightGroup.appendChild(updateBtn);
    }
    titleRow.appendChild(rightGroup);
    summary.appendChild(titleRow);
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

export function setFetchReportStatusIcon(failedCount: number): void {
    const icon = document.getElementById(FETCH_STATUS_ICON_ID) as HTMLButtonElement | null;
    if (!icon) return;
    icon.style.display = 'inline-flex';
    icon.classList.toggle('pvs-fetch-error', failedCount > 0);
    icon.title =
    failedCount === 0 ? '抓價報告：正常' : `抓價報告：有 ${failedCount} 檔異常，點擊查看`;
    icon.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const details = document.getElementById(FETCH_DETAILS_ID) as HTMLDetailsElement | null;
        if (details) {
            details.open = true;
            details.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    };
}

export function setDailyDetailButtonVisible(show: boolean): void {
    const btn = document.getElementById(DAILY_DETAIL_BTN_ID) as HTMLButtonElement | null;
    if (!btn) return;
    btn.style.display = show ? 'inline-flex' : 'none';
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

function buildDailyDetailTableHTML(data: DailyDetailData): string {
    const opts = data;
    const rows = data.rows;
    const anchorTicker = opts.anchorTicker ?? 'VTI';
    const modeLabel = opts.mode === 'close' ? '收盤價' : '調整後收盤價';
    const noteItems = [
        `目前市值計算標準：${modeLabel}`,
        '比較規則：BUY-only（SELL 不納入比較）',
        '拆股還原規則：僅套用 splitDate > tradeDate（同日不套用）',
        '若價格有回補，會標示使用的實際日期',
    ];
    return `
        <div class="summary-body">
            <div class="subhdr">
            <ul>${noteItems.map((x) => `<li>${x}</li>`).join('')}</ul>
            </div>
            <div style="overflow:auto; max-height: 70vh;">
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
}

export function openDailyDetailModal(data: DailyDetailData): void {
    ensureStyle();
    const existing = document.getElementById(MODAL_OVERLAY_ID);
    if (existing) return;
    const overlay = document.createElement('div');
    overlay.id = MODAL_OVERLAY_ID;
    const panel = document.createElement('div');
    panel.id = MODAL_PANEL_ID;
    const header = document.createElement('div');
    header.className = 'pvs-modal-header';
    const titleSpan = document.createElement('span');
    titleSpan.textContent = '每日明細';
    header.appendChild(titleSpan);
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'pvs-modal-close';
    closeBtn.setAttribute('aria-label', '關閉');
    closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    const body = document.createElement('div');
    body.className = 'pvs-modal-body';
    const tableWrapper = document.createElement('div');
    tableWrapper.id = TABLE_ID;
    tableWrapper.innerHTML = buildDailyDetailTableHTML(data);
    body.appendChild(tableWrapper);
    panel.appendChild(header);
    header.appendChild(closeBtn);
    panel.appendChild(body);
    overlay.appendChild(panel);
    function close(): void {
        overlay.remove();
    }
    overlay.onclick = (e) => {
        if (e.target === overlay) close();
    };
    closeBtn.onclick = close;
    document.body.appendChild(overlay);
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

export type ViewMode = 'trend' | number;

function ensureToggleRows(): {
  root: HTMLDivElement;
  valueRow: HTMLDivElement;
  priceRow: HTMLDivElement;
  viewModeRow: HTMLDivElement;
} {
  const root = ensureToggleBeforeChart();
  const oldTimeRangeRow = root.querySelector<HTMLDivElement>('div[data-row="timerange"]');
  if (oldTimeRangeRow) oldTimeRangeRow.remove();
  let valueRow = root.querySelector<HTMLDivElement>('div[data-row="value"]') ?? null;
  let priceRow = root.querySelector<HTMLDivElement>('div[data-row="price"]') ?? null;
  let viewModeRow = root.querySelector<HTMLDivElement>('div[data-row="viewmode"]') ?? null;

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
  if (!viewModeRow) {
    viewModeRow = document.createElement('div');
    viewModeRow.className = 'row';
    viewModeRow.setAttribute('data-row', 'viewmode');
    root.appendChild(viewModeRow);
  }

  // Enforce order: value => price => viewMode (走勢 + years).
  if (root.firstChild !== valueRow) root.insertBefore(valueRow, root.firstChild);
  if (valueRow.nextSibling !== priceRow) root.insertBefore(priceRow, valueRow.nextSibling);
  if (priceRow.nextSibling !== viewModeRow) root.insertBefore(viewModeRow, priceRow.nextSibling);

  return { root, valueRow, priceRow, viewModeRow };
}

export function renderViewModeButtons(
  years: number[],
  selected: ViewMode,
  onChange: (v: ViewMode) => void
): void {
  const { viewModeRow } = ensureToggleRows();
  const trendActive = selected === 'trend';
  const buttons = [
    `<button class="btn ${trendActive ? 'active' : ''}" data-view="trend" type="button" title="全部期間的投資表現（含所有年度累積）">全部期間</button>`,
    ...years.map(
      (y) =>
        `<button class="btn ${selected === y ? 'active' : ''}" data-view="${y}" type="button" title="${y} 年度新增投入（僅該年買入，無前期累積）">${y}</button>`
    ),
  ];
  viewModeRow.innerHTML = `<div class="btn-group">${buttons.join('')}</div>`;
  viewModeRow.querySelectorAll<HTMLButtonElement>('button[data-view]').forEach((b) => {
    const v = b.getAttribute('data-view');
    if (!v) return;
    b.onclick = () => onChange(v === 'trend' ? 'trend' : parseInt(v, 10));
  });
}

export function renderYearlySummary(data: {
  portfolioReturn: number;
  vtiReturn: number;
  lastPortfolio?: number;
  lastVti?: number;
  valueMode: ValueMode;
} | null): void {
  const wrapper = document.getElementById(WRAPPER_ID);
  if (!wrapper) return;
  let div = document.getElementById(YEARLY_SUMMARY_ID) as HTMLDivElement | null;
  if (!data) {
    div?.remove();
    return;
  }
  if (!div) {
    div = document.createElement('div');
    div.id = YEARLY_SUMMARY_ID;
    wrapper.appendChild(div);
    orderWrapperChildren(wrapper);
  }
  let text = '';
  if (data.valueMode === 'amount') {
    const p = formatNumber(data.lastPortfolio);
    const v = formatNumber(data.lastVti);
    text = `投資組合：${p}&emsp;|&emsp;VTI 組合：${v}`;
  } else if (data.valueMode === 'percent') {
    const pRet = formatPercent(data.portfolioReturn * 100);
    const vRet = formatPercent(data.vtiReturn * 100);
    text = `投資組合：${pRet}&emsp;|&emsp;VTI 組合：${vRet}`;
  } else {
    const lp = data.lastPortfolio;
    const lv = data.lastVti;
    const denom = typeof lv === 'number' && Number.isFinite(lv) && Math.abs(lv) > 1e-12 ? lv : null;
    const excessPct = denom != null && typeof lp === 'number' && Number.isFinite(lp) ? (lp / denom - 1) * 100 : NaN;
    text = `超額：${formatPercent(excessPct)}`;
  }
  div.innerHTML = `
    <div class="row" style="font-size:12px; color:#374151; padding:4px 8px; text-align:center;">
      ${text}
    </div>
  `;
  div.style.display = '';
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
    return row.holdingsAfter.map((h) => `•\u00A0${h.ticker}:${fmt(h.shares)}`).join('\n');
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
            <button class="btn ${mode === 'adjclose' ? 'active' : ''}" data-mode="adjclose" type="button">調整後收盤價</button>
            <button class="btn ${mode === 'close' ? 'active' : ''}" data-mode="close" type="button">收盤價</button>
        </div>
        <div class="pvs-hint-info" title="市值計算標準" aria-label="說明"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg></div>
    `;
    priceRow.querySelectorAll<HTMLButtonElement>('button[data-mode]').forEach((b) => {
        b.onclick = () => {
            const m = b.getAttribute('data-mode') as PriceMode | null;
            if (!m) return;
            onChange(m);
        };
    });
}

const VALUE_MODE_TOOLTIPS: Record<ValueMode, string> = {
  amount: '投資組合與 VTI 組合的市值',
  percent: '投資組合與 VTI 組合的累積報酬 % = (市值 / 累積投入金額 - 1) × 100%',
  excess: '投資組合相對 VTI 組合的超額報酬 % = (投資組合市值 / VTI 組合市值 - 1) × 100%',
};

export function renderValueModeToggle(mode: ValueMode, onChange: (mode: ValueMode) => void): void {
    const { valueRow } = ensureToggleRows();
    const tooltip = VALUE_MODE_TOOLTIPS[mode];
    valueRow.innerHTML = `
        <div class="btn-group">
            <button class="btn" data-vmode="excess" type="button" title="超額報酬 % = (投資組合市值 / VTI 市值 - 1) × 100%（相對 VTI 的超額報酬 %）">超額報酬 %</button>
            <button class="btn" data-vmode="percent" type="button" title="累積報酬 % = (市值 / 累積投入金額 - 1) × 100%（投資組合與 VTI 皆以各自市值計）">累積報酬 %</button>
            <button class="btn" data-vmode="amount" type="button" title="顯示投資組合與 VTI 的市值（金額）">市值</button>
        </div>
        <div class="pvs-hint-info" title="${tooltip.replace(/"/g, '&quot;')}" aria-label="說明"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg></div>
    `;

    valueRow.querySelectorAll<HTMLButtonElement>('button[data-vmode]').forEach((b) => {
        const m = b.getAttribute('data-vmode') as ValueMode | null;
        if (!m) return;
        b.classList.toggle('active', m === mode);
        b.onclick = () => onChange(m);
    });
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
    <div class="fetch-report-headline">${headline}</div>
    <div class="summary-body" style="padding:10px 24px;">
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
  `;
  setFetchReportStatusIcon(failed.length);
}
