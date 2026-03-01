import { PRIMARY_COLOR } from '../extension/tableMount';
import type { ComputedSeries } from './types';

type MaybeDebugRow = {
  events?: { type?: string; ticker?: string; cash?: number }[];
  dayCashTotal?: number;
};
type MaybeWithDebug = ComputedSeries & { debugRows?: MaybeDebugRow[] };

export type ChartValueMode = 'percent' | 'excess' | 'amount';

function formatNumber(n: unknown): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return String(n ?? '');
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatPercent(n: unknown): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return String(n ?? '');
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function summarizeTradesByTicker(events: { ticker?: string; cash?: number }[]): { lines: string[]; total: number } {
  const acc = new Map<string, number>(); // ticker -> cash sum
  let total = 0;
  for (const e of events) {
    const ticker = String(e?.ticker ?? '').trim();
    if (!ticker) continue;
    const cash = typeof e?.cash === 'number' && Number.isFinite(e.cash) ? e.cash : 0;
    total += cash;
    acc.set(ticker, (acc.get(ticker) ?? 0) + cash);
  }
  const lines = [...acc.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([t, v]) => `${t}: ${formatNumber(v)}`);
  return { lines, total };
}

function toReturnPercentByCumulativeCash(
  points: { tsMs: number; value: number }[],
  debugRows: MaybeDebugRow[] | undefined
): [number, number][] {
  // Prefer (value / cumulativeCash - 1) for BUY-only incremental-invest flows.
  // This avoids the misleading "value / firstValue" explosion when the portfolio keeps receiving new cash.
  if (Array.isArray(debugRows) && debugRows.length === points.length) {
    let cumCash = 0;
    return points.map((p, i) => {
      const dayCash = debugRows[i]?.dayCashTotal;
      if (typeof dayCash === 'number' && Number.isFinite(dayCash)) cumCash += dayCash;
      const denom = Math.abs(cumCash) > 1e-12 ? cumCash : null;
      const pct = denom ? ((p.value / denom - 1) * 100) : 0;
      return [p.tsMs, pct];
    });
  }

  // Fallback: if debugRows isn't available (demo/tests), use the first point as baseline.
  const base = points[0]?.value ?? 0;
  const denom = typeof base === 'number' && Number.isFinite(base) && Math.abs(base) > 1e-12 ? base : null;
  return points.map((p) => [p.tsMs, denom ? ((p.value / denom - 1) * 100) : 0]);
}

function toAmount(points: { tsMs: number; value: number }[]): [number, number][] {
  return points.map((p) => [p.tsMs, p.value]);
}

function toExcessPercent(portfolio: { tsMs: number; value: number }[], vti: { tsMs: number; value: number }[]): [number, number][] {
  const n = Math.min(portfolio.length, vti.length);
  const out: [number, number][] = [];
  for (let i = 0; i < n; i += 1) {
    const p = portfolio[i]!;
    const v = vti[i]!;
    const denom = typeof v.value === 'number' && Number.isFinite(v.value) && Math.abs(v.value) > 1e-12 ? v.value : null;
    const pct = denom ? ((p.value / denom - 1) * 100) : 0;
    out.push([p.tsMs, pct]);
  }
  return out;
}

function zerosLike(points: { tsMs: number }[]): [number, number][] {
  return points.map((p) => [p.tsMs, 0]);
}

export function buildEchartsOption(
  series: ComputedSeries,
  opts?: { valueMode?: ChartValueMode; title?: string; subtext?: string; useDataZoom?: boolean }
): any {
  const dbg = (series as MaybeWithDebug).debugRows;
  const valueMode: ChartValueMode = opts?.valueMode ?? 'amount';
  const titleText = opts?.title ?? 'Portfolio vs VTI';
  const subtext = opts?.subtext;
  const useDataZoom = opts?.useDataZoom === true;

  const portfolioData =
        valueMode === 'percent'
        ? toReturnPercentByCumulativeCash(series.portfolio, dbg)
        : valueMode === 'excess'
            ? toExcessPercent(series.portfolio, series.vti)
            : toAmount(series.portfolio);
    const vtiData =
        valueMode === 'percent'
        ? toReturnPercentByCumulativeCash(series.vti, dbg)
        : valueMode === 'excess'
            ? zerosLike(series.vti)
            : toAmount(series.vti);

    const tooltipFormatter = (params: any): string => {
        const list = Array.isArray(params) ? params : [params];
        const first = list[0];
        const tsMs = Array.isArray(first?.value) ? first.value[0] : first?.axisValue;
        const dateLabel = tsMs ? new Date(tsMs).toISOString().slice(0, 10) : '';
        const idx: number | null =
            typeof first?.dataIndex === 'number' && Number.isFinite(first.dataIndex) ? Number(first.dataIndex) : null;

        let tradesBlock = '';
        if (idx != null && Array.isArray(dbg) && dbg[idx] && Array.isArray(dbg[idx].events)) {
            const events = dbg[idx].events ?? [];
            const tickers = uniq(events.map((e) => String(e?.ticker ?? '').trim()).filter((t) => t.length > 0));
            const { lines: tradeLines, total } = summarizeTradesByTicker(events);
            if (tickers.length > 0 || tradeLines.length > 0) {
                const sep = '<div style="border-top:1px solid #9ca3af; margin:6px 0;"></div>';
                // Privacy: in percent/excess mode, do NOT show trade cash amounts (still lists tickers).
                const body =
                valueMode === 'percent' || valueMode === 'excess'
                    ? `${tickers.join('<br/>')}<br/>`
                    : tradeLines.length
                    ? `${tradeLines.join('<br/>')}<br/>`
                    : `${tickers.join('<br/>')}<br/>`;
                const totalLine = valueMode === 'percent' || valueMode === 'excess' ? '' : `total trade value: ${formatNumber(total)}<br/>`;
                tradesBlock = `${sep}${body}${sep}${totalLine}`;
            }
        }

        const lines = list
            .map((p: any) => {
                const name = String(p?.seriesName ?? '');
                const v = Array.isArray(p?.value) ? p.value[1] : p?.value;
                return `${name}: ${valueMode === 'amount' ? formatNumber(v) : formatPercent(v)}`;
            })
            .join('<br/>');

        return `${dateLabel}<br/>${tradesBlock}${lines}`;
    };

    const CHART_PRIMARY_COLOR = PRIMARY_COLOR + 'b3';

    const baseOption: any = {
        title: {
            text: titleText,
            subtext: subtext ?? '',
            left: 'center',
            padding: [0, 0, 8, 0],
            textStyle: { color: PRIMARY_COLOR, fontSize: 20 },
            subtextStyle: { color: '#6b7280', fontSize: 12 },
        },
        tooltip: { trigger: 'axis', formatter: tooltipFormatter },
        legend: {
            data: valueMode === 'excess' ? ['超額績效 %'] : ['portfolio', 'vti'],
            bottom: useDataZoom ? '14%' : '0%',
        },
        grid: {
            left: '0%',
            right: '1%',
            bottom: useDataZoom ? '24%' : '12%',
            containLabel: true,
        },
        toolbox: {
            feature: {
                dataZoom: {
                    yAxisIndex: 'none',
                    title: {
                        zoom: '區域縮放',
                        back: '還原縮放'
                    }
                },
                restore: {
                    title: '還原'
                },
                saveAsImage: {
                    title: '儲存為圖片'
                }
            }
        },
        xAxis: {
            type: 'time',
            boundaryGap: false
        },
        yAxis:
            valueMode === 'amount'
                ? { type: 'value' }
                : valueMode === 'percent'
                ? {
                    type: 'value',
                    axisLabel: { formatter: (v: number) => `${v}%`, margin: 8 },
                    name: '累積報酬 %',
                    nameGap: 20,
                    nameTextStyle: { align: 'center', padding: [0, 20, 0, 0] },
                    }
                : {
                    type: 'value',
                    axisLabel: { formatter: (v: number) => `${v}%`, margin: 8 },
                    name: '超額績效 %',
                    nameGap: 20,
                    nameTextStyle: { align: 'center', padding: [0, 12, 0, 0] },
                    },
        series: [
        {
            name: valueMode === 'excess' ? '超額績效 %' : 'portfolio',
            type: 'line',
            showSymbol: false,
            clip: false,
            symbolSize: 10,
            lineStyle: { color: '#f45a4c', width: 1.5, opacity: 1 },
            itemStyle: { color: '#f45a4c' },
            data: portfolioData,
        },
        {
            name: valueMode === 'excess' ? 'baseline' : 'vti',
            type: 'line',
            showSymbol: false,
            clip: false,
            symbolSize: 10,
            lineStyle: {
            color: CHART_PRIMARY_COLOR,
            width: 1.5,
            opacity: valueMode === 'excess' ? 0 : 1,
            },
            itemStyle: { color: CHART_PRIMARY_COLOR },
            data: vtiData,
        },
        ],
    };

    if (useDataZoom) {
        baseOption.dataZoom = [
        { type: 'inside', xAxisIndex: 0, start: 0, end: 100, zoomOnMouseWheel: false },
        {
            type: 'slider',
            xAxisIndex: 0,
            start: 0,
            end: 100,
            handleStyle: { color: CHART_PRIMARY_COLOR, borderColor: CHART_PRIMARY_COLOR },
            dataBackground: { lineStyle: { color: PRIMARY_COLOR } },
            selectedDataBackground: { lineStyle: { color: PRIMARY_COLOR } },
        },
        ];
    }

  return baseOption;
}