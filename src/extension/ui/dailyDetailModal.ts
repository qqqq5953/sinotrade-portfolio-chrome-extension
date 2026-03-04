/**
 * Daily detail modal: opens a modal with per-day breakdown table.
 */
import { formatNumber } from '../../core/utils/number';
import type { DebugDayRow } from '../../core/domain/computeDebug';
import type { PriceSeries } from '../../core/domain/types';
import {
  ensureStyle,
  MODAL_OVERLAY_ID,
  MODAL_PANEL_ID,
  TABLE_ID,
  type DailyDetailData
} from './extensionUI';

function eventSummary(row: DebugDayRow): string {
  return row.events
    .map((e) =>
      [
        `${e.type} ${e.ticker}`,
        `•\u00A0shares=${formatNumber(e.shares)}`,
        `•\u00A0cash=${formatNumber(e.cash)}`,
        `•\u00A0vtiΔ=${formatNumber(e.vtiDeltaShares)}`
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
      return `${e.ticker} raw=${formatNumber(raw)} × ${formatNumber(factor)} => ${formatNumber(e.shares)}${chain}`;
    })
    .filter((x) => x.length > 0);
  return lines.length > 0 ? lines.join('\n') : '(none)';
}

function holdingsSummary(row: DebugDayRow): string {
  if (row.holdingsAfter.length === 0) return '(empty)';
  return row.holdingsAfter.map((h) => `•\u00A0${h.ticker}:${formatNumber(h.shares)}`).join('\n');
}

function lookup(series: PriceSeries | undefined, isoDateET: string): number | null {
  if (!series) return null;
  const v = series.get(isoDateET);
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
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
    '若價格有回補，會標示使用的實際日期'
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
                          `•\u00A0close=${vtiClose == null ? '—' : formatNumber(vtiClose)}`,
                          `•\u00A0adj=${vtiAdj == null ? '—' : formatNumber(vtiAdj)}`,
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
                              `•\u00A0close=${c == null ? '—' : formatNumber(c)}`,
                              `•\u00A0adj=${a == null ? '—' : formatNumber(a)}`,
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
                                <td class="mono">${formatNumber(r.dayCashTotal)}</td>
                                <td class="mono">${formatNumber(r.vtiDeltaSharesTotal)}</td>
                                <td class="mono">${holdingsSummary(r)}</td>
                                <td class="mono">${priceLines || '(no holdings)'}</td>
                                <td class="mono">${vtiPrice}</td>
                                <td class="mono">${formatNumber(r.portfolioValue)}</td>
                                <td class="mono">${formatNumber(r.vtiShares)}</td>
                                <td class="mono">${formatNumber(r.vtiValue)}</td>
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
  closeBtn.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
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
