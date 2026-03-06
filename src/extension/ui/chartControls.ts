/**
 * Chart controls: price/value mode toggles, view mode buttons, yearly summary.
 */
import { formatNumber, formatPercent } from '../../core/utils/number';
import {
  ensureStyle,
  ensurePvsWrapper,
  orderWrapperChildren,
  TOGGLE_ID,
  YEARLY_SUMMARY_ID,
  WRAPPER_ID,
  type PriceMode,
  type ValueMode,
  type ViewMode
} from './extensionUI';

export type { ViewMode };

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
    )
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
    const excessPct =
      denom != null && typeof lp === 'number' && Number.isFinite(lp) ? (lp / denom - 1) * 100 : NaN;
    text = `超額：${formatPercent(excessPct)}`;
  }
  div.innerHTML = `
    <div class="row" style="font-size:12px; color:#374151; padding:4px 8px; text-align:center;">
      ${text}
    </div>
  `;
  div.style.display = '';
}

const INSIGHT_SUMMARY_ID = 'pvs-insight-summary';

export function renderInsightSummary(text: string | null): void {
  const wrapper = document.getElementById(WRAPPER_ID);
  if (!wrapper) return;
  let div = document.getElementById(INSIGHT_SUMMARY_ID) as HTMLDivElement | null;
  if (!text) {
    div?.remove();
    return;
  }
  if (!div) {
    div = document.createElement('div');
    div.id = INSIGHT_SUMMARY_ID;
    div.style.fontSize = '12px';
    div.style.color = '#374151';
    div.style.padding = '4px 0px 8px 0px';
  }
  const chartEl = document.getElementById('chart');
  if (chartEl && chartEl.parentElement === wrapper) {
    if (div.parentElement !== wrapper || div.previousSibling !== chartEl) {
      wrapper.insertBefore(div, chartEl.nextSibling);
    }
  } else if (!div.parentElement) {
    wrapper.appendChild(div);
  }
  div.textContent = text;
}

const VALUE_MODE_TOOLTIPS: Record<ValueMode, string> = {
  amount: '投資組合與 VTI 組合的市值',
  percent: '投資組合與 VTI 組合的累積報酬 % = (市值 / 累積投入金額 - 1) × 100%',
  excess: '投資組合相對 VTI 組合的超額報酬 % = (投資組合市值 / VTI 組合市值 - 1) × 100%'
};

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
