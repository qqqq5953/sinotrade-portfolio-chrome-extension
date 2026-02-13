import type { ComputedSeries } from './types';

type MaybeDebugRow = { events?: { type?: string; ticker?: string; cash?: number }[] };
type MaybeWithDebug = ComputedSeries & { debugRows?: MaybeDebugRow[] };

function fmtNumber(n: unknown): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return String(n ?? '');
  return n.toLocaleString('en-US', { maximumFractionDigits: 6 });
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

export function buildEchartsOption(series: ComputedSeries): any {
  const dbg = (series as MaybeWithDebug).debugRows;

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
        const body = tradeLines.length ? `${tradeLines.join('<br/>')}<br/>` : `${tickers.join('<br/>')}<br/>`;
        tradesBlock = `${sep}${body}${sep}total trade value: ${fmtNumber(total)}<br/>`;
      }
    }

    const lines = list
      .map((p: any) => {
        const name = String(p?.seriesName ?? '');
        const v = Array.isArray(p?.value) ? p.value[1] : p?.value;
        return `${name}: ${fmtNumber(v)}`;
      })
      .join('<br/>');

    return `${dateLabel}<br/>${tradesBlock}${lines}`;
  };

  return {
    title: { text: 'Portfolio vs VTI' },
    tooltip: { trigger: 'axis', formatter: tooltipFormatter },
    legend: { data: ['portfolio', 'vti'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    toolbox: { feature: { saveAsImage: {} } },
    xAxis: { type: 'time', boundaryGap: false },
    yAxis: { type: 'value' },
    series: [
      {
        name: 'portfolio',
        type: 'line',
        showSymbol: false,
        data: series.portfolio.map((p) => [p.tsMs, p.value])
      },
      {
        name: 'vti',
        type: 'line',
        showSymbol: false,
        data: series.vti.map((p) => [p.tsMs, p.value])
      }
    ]
  };
}

