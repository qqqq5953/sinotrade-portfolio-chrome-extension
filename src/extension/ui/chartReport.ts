/**
 * Chart report: rules section, fetch report section.
 */
import {
  ensureStyle,
  ensurePvsWrapper,
  orderWrapperChildren,
  FETCH_DETAILS_ID,
  FETCH_ID,
  RULES_DETAILS_ID,
  RULES_ID
} from './extensionUI';
import { setFetchReportStatusIcon } from './accordionMount';

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
