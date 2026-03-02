/**
 * Shared UI infrastructure: styles, layout helpers, constants.
 * Other UI modules (accordion, modal, controls, report) depend on this.
 */
import type { DebugDayRow, PriceSeries } from '../../core';

const STYLE_ID = 'pvs-debug-table-style';
export const TABLE_ID = 'pvs-debug-table';
export const TOGGLE_ID = 'pvs-price-toggle';
export const FETCH_ID = 'pvs-fetch-report';
export const RULES_ID = 'pvs-chart-rules';

/** Wrapper for all extension UI under #TagSelectArea (flex column, gap). */
export const WRAPPER_ID = 'pvs-chart-block';

export const ACCORDION_ID = 'pvs-accordion';
export const ACCORDION_BODY_ID = 'pvs-accordion-body';
export const ACCORDION_LOADER_ID = 'pvs-accordion-loader';
export const ACCORDION_STATUS_ID = 'pvs-accordion-status';
export const FETCH_STATUS_ICON_ID = 'pvs-fetch-status-icon';

export const RULES_DETAILS_ID = 'pvs-rules-details';
export const FETCH_DETAILS_ID = 'pvs-fetch-details';

export const YEARLY_SUMMARY_ID = 'pvs-yearly-summary';
const BLOCK_ORDER = [TOGGLE_ID, 'chart', YEARLY_SUMMARY_ID, RULES_DETAILS_ID, FETCH_DETAILS_ID] as const;

export const MODAL_OVERLAY_ID = 'pvs-daily-detail-modal-overlay';
export const MODAL_PANEL_ID = 'pvs-daily-detail-modal-panel';
export const DAILY_DETAIL_BTN_ID = 'pvs-daily-detail-btn';

/** When set (e.g. accordion body), chart block is inserted here instead of TagSelectArea. */
let chartBlockParent: HTMLElement | null = null;

export function setChartBlockParent(el: HTMLElement | null): void {
  chartBlockParent = el;
}

/** 主色，用於按鈕、標題等，與網站配色一致 */
export const PRIMARY_COLOR = '#3f5372';

export type PriceMode = 'close' | 'adjclose';
export type ValueMode = 'amount' | 'percent' | 'excess';
export type ViewMode = 'trend' | number;

export type AccordionRef = { details: HTMLDetailsElement; body: HTMLDivElement };

export type DailyDetailData = {
  rows: DebugDayRow[];
  mode: PriceMode;
  closeSeriesByTicker: Map<string, PriceSeries>;
  adjSeriesByTicker: Map<string, PriceSeries>;
  anchorTicker?: string;
};

export function ensureStyle(): void {
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

export function getTagArea(): HTMLElement | null {
  return document.getElementById('TagSelectArea') as HTMLElement | null;
}

export function orderWrapperChildren(wrapper: HTMLElement): void {
  for (const id of BLOCK_ORDER) {
    const el = document.getElementById(id);
    if (el && el.parentElement === wrapper) wrapper.appendChild(el);
  }
}

export function ensurePvsWrapper(): HTMLDivElement {
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
