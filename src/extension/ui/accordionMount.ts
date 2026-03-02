/**
 * Accordion: collapsible "圖表與分析" panel with buttons (抓價報告, 每日明細, 更新資料).
 */
import {
  ensureStyle,
  getTagArea,
  ACCORDION_ID,
  ACCORDION_BODY_ID,
  ACCORDION_LOADER_ID,
  ACCORDION_STATUS_ID,
  FETCH_STATUS_ICON_ID,
  FETCH_DETAILS_ID,
  DAILY_DETAIL_BTN_ID,
  PRIMARY_COLOR,
  type AccordionRef
} from './extensionUI';
import type { DailyDetailData } from './extensionUI';
import { openDailyDetailModal } from './dailyDetailModal';

let dailyDetailDataProvider: (() => DailyDetailData | null) | null = null;

export function setDailyDetailDataProvider(provider: () => DailyDetailData | null): void {
  dailyDetailDataProvider = provider;
}

const FETCH_STATUS_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y1="13"/><line x1="16" y1="17" x2="8" y1="17"/><line x1="10" y1="9" x2="8" y1="9"/></svg>`;
const DAILY_DETAIL_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`;

function createFetchStatusIconButton(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = FETCH_STATUS_ICON_ID;
  btn.className = FETCH_STATUS_ICON_ID;
  btn.setAttribute('aria-label', '抓價報告');
  btn.title = '抓價報告';
  btn.style.display = 'none';
  btn.innerHTML = FETCH_STATUS_ICON_SVG;
  return btn;
}

function createDailyDetailButton(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = DAILY_DETAIL_BTN_ID;
  btn.className = 'pvs-header-icon-btn';
  btn.setAttribute('aria-label', '每日明細');
  btn.title = '每日明細：查看每個交易日的持倉、市值與計算依據';
  btn.style.display = 'none';
  btn.innerHTML = DAILY_DETAIL_ICON_SVG;
  btn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const data = dailyDetailDataProvider?.() ?? null;
    if (!data) {
      alert('請先完成計算後再查看每日明細。');
      return;
    }
    openDailyDetailModal(data);
  };
  return btn;
}

function createUpdateButton(onUpdate: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = '更新資料';
  btn.style.fontSize = '12px';
  btn.style.fontWeight = '400';
  btn.style.cursor = 'pointer';
  btn.style.border = '1px solid #d9dde3';
  btn.style.borderRadius = '4px';
  btn.style.padding = '4px 8px';
  btn.style.background = '#fff';
  btn.style.color = PRIMARY_COLOR;
  btn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onUpdate();
  };
  return btn;
}

function createAccordionTitleRow(opts?: { onUpdate?: () => void }): HTMLDivElement {
  const titleRow = document.createElement('div');
  titleRow.className = 'pvs-accordion-title-row';
  const leftGroup = document.createElement('div');
  leftGroup.className = 'pvs-accordion-title-left';
  const title = document.createElement('span');
  title.textContent = '圖表與分析';
  leftGroup.appendChild(title);
  titleRow.appendChild(leftGroup);
  const rightGroup = document.createElement('div');
  rightGroup.className = 'pvs-accordion-title-right';
  rightGroup.appendChild(createFetchStatusIconButton());
  rightGroup.appendChild(createDailyDetailButton());
  if (opts?.onUpdate) {
    rightGroup.appendChild(createUpdateButton(opts.onUpdate));
  }
  titleRow.appendChild(rightGroup);
  return titleRow;
}

function createAccordionSummary(opts?: { onUpdate?: () => void }): HTMLElement {
  const summary = document.createElement('summary');
  summary.style.display = 'flex';
  summary.style.alignItems = 'center';
  summary.style.justifyContent = 'space-between';
  summary.style.gap = '8px';
  summary.appendChild(createAccordionTitleRow(opts));
  return summary;
}

function createAccordionBody(): HTMLDivElement {
  const body = document.createElement('div');
  body.id = ACCORDION_BODY_ID;
  body.style.padding = '0 12px';
  return body;
}

function createAccordionElement(opts?: { onUpdate?: () => void }): HTMLDetailsElement {
  const details = document.createElement('details');
  details.id = ACCORDION_ID;
  details.appendChild(createAccordionSummary(opts));
  details.appendChild(createAccordionBody());
  return details;
}

function insertAccordionIntoDOM(tagArea: HTMLElement, details: HTMLDetailsElement): void {
  const children = Array.from(tagArea.children);
  const insertBefore = children[1] ?? null;
  if (insertBefore) {
    tagArea.insertBefore(details, insertBefore);
  } else {
    tagArea.appendChild(details);
  }
}

export function mountAccordion(opts?: { onUpdate?: () => void }): AccordionRef {
  ensureStyle();
  const tagArea = getTagArea();
  if (!tagArea) throw new Error('TagSelectArea not found');
  const existing = document.getElementById(ACCORDION_ID) as HTMLDetailsElement | null;
  if (existing) {
    const body = document.getElementById(ACCORDION_BODY_ID) as HTMLDivElement;
    return { details: existing, body: body! };
  }
  const details = createAccordionElement(opts);
  insertAccordionIntoDOM(tagArea, details);
  const body = document.getElementById(ACCORDION_BODY_ID) as HTMLDivElement;
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
