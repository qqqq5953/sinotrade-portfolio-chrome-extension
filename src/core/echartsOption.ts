import type { ComputedSeries } from './types';

type MaybeDebugRow = {
  events?: { type?: string; ticker?: string; cash?: number }[];
  dayCashTotal?: number;
};
type MaybeWithDebug = ComputedSeries & { debugRows?: MaybeDebugRow[] };

export type ChartValueMode = 'percent' | 'excess' | 'amount';

function fmtNumber(n: unknown): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return String(n ?? '');
  return n.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

function fmtPercent(n: unknown): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return String(n ?? '');
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toLocaleString('en-US', { maximumFractionDigits: 4 })}%`;
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
    .map(([t, v]) => `${t}: ${fmtNumber(v)}`);
  return { lines, total };
}

function toReturnPctByCumulativeCash(
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

function toExcessPct(portfolio: { tsMs: number; value: number }[], vti: { tsMs: number; value: number }[]): [number, number][] {
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

export function buildEchartsOption(series: ComputedSeries, opts?: { valueMode?: ChartValueMode }): any {
  const dbg = (series as MaybeWithDebug).debugRows;
  const valueMode: ChartValueMode = opts?.valueMode ?? 'amount';

  const portfolioData =
    valueMode === 'percent'
      ? toReturnPctByCumulativeCash(series.portfolio, dbg)
      : valueMode === 'excess'
        ? toExcessPct(series.portfolio, series.vti)
        : toAmount(series.portfolio);
  const vtiData =
    valueMode === 'percent'
      ? toReturnPctByCumulativeCash(series.vti, dbg)
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
        const totalLine = valueMode === 'percent' || valueMode === 'excess' ? '' : `total trade value: ${fmtNumber(total)}<br/>`;
        tradesBlock = `${sep}${body}${sep}${totalLine}`;
      }
    }

    const lines = list
      .map((p: any) => {
        const name = String(p?.seriesName ?? '');
        const v = Array.isArray(p?.value) ? p.value[1] : p?.value;
        return `${name}: ${valueMode === 'amount' ? fmtNumber(v) : fmtPercent(v)}`;
      })
      .join('<br/>');

    return `${dateLabel}<br/>${tradesBlock}${lines}`;
  };

  return {
    title: { 
        text: 'Portfolio vs VTI', 
        left: 'center', 
        padding: [0, 0, 8, 0], 
        textStyle: { color: '#3f5372', fontSize: 20 }
    },
    tooltip: { trigger: 'axis', formatter: tooltipFormatter },
    legend: { 
        data: valueMode === 'excess' ? ['excess vs VTI', 'baseline'] : ['portfolio', 'vti'], 
        top: '5%' 
    },
    grid: {
      left: '0%',
      right: '0%',
      bottom: '3%',
      containLabel: true
    },
    toolbox: { feature: { saveAsImage: {} } },
    xAxis: { type: 'time', boundaryGap: false },
    yAxis:
      valueMode === 'amount'
        ? { type: 'value' }
        : valueMode === 'percent'
          ? {
              type: 'value',
              axisLabel: { formatter: (v: number) => `${v}%`, margin: 8 },
              name: 'Return %',
              nameGap: 20,
              nameTextStyle: { align: 'center', padding: [0, 20, 0, 0] },
            }
          : {
              type: 'value',
              axisLabel: { formatter: (v: number) => `${v}%`, margin: 8 },
              name: 'Excess %',
              nameGap: 20,
              nameTextStyle: { align: 'center', padding: [0, 12, 0, 0] },
            },
    series: [
      {
        name: valueMode === 'excess' ? 'excess vs VTI' : 'portfolio',
        type: 'line',
        showSymbol: false,
        lineStyle: { color: '#c43826' },
        itemStyle: { color: '#c43826' },
        data: portfolioData
      },
      {
        name: valueMode === 'excess' ? 'baseline' : 'vti',
        type: 'line',
        showSymbol: false,
        lineStyle: { color: '#3f5372' },
        itemStyle: { color: '#3f5372' },
        data: vtiData
      }
    ]
  };
}

