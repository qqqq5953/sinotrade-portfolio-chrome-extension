import * as echarts from 'echarts';
import { computePortfolioVsVtiSeries, buildEchartsOption, parseBuyTable, parseSellTable } from './core';
import type { PriceSeries } from './core/types';

function must<T extends Element>(selector: string): T {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el as T;
}

function ensureChartContainer(): HTMLDivElement {
  const tagArea = must<HTMLElement>('#TagSelectArea');
  const existing = document.querySelector('#chart') as HTMLDivElement | null;
  if (existing) return existing;

  const div = document.createElement('div');
  div.id = 'chart';
  div.style.width = '100%';
  div.style.height = '400px';

  const children = Array.from(tagArea.children);
  const secondChild = children[1] ?? null;
  if (secondChild) tagArea.insertBefore(div, secondChild);
  else tagArea.appendChild(div);
  return div;
}

function fixturePrices(): Map<string, PriceSeries> {
  const aaa: PriceSeries = new Map([
    // Intentionally missing 2024-01-03 to demonstrate anchor shift to 2024-01-02 in compute logic.
    ['2024-01-02', 10],
    ['2024-01-10', 12]
  ]);
  const vti: PriceSeries = new Map([
    ['2024-01-02', 100],
    ['2024-01-10', 110]
  ]);
  return new Map([
    ['AAA', aaa],
    ['VTI', vti]
  ]);
}

function runDemo(): void {
  const buyTable = must<HTMLTableElement>('.buy-table');
  const sellTable = must<HTMLTableElement>('.sell-table');
  const events = [...parseBuyTable(buyTable, { demo: true }), ...parseSellTable(sellTable, { demo: true })];

  const computed = computePortfolioVsVtiSeries({
    events,
    priceSeriesByTicker: fixturePrices(),
    maxBackTradingDays: 7,
    anchorTicker: 'VTI'
  });

  const container = ensureChartContainer();
  const chart = echarts.init(container);
  chart.setOption(buildEchartsOption(computed), { notMerge: true });
}

must<HTMLButtonElement>('#btn').addEventListener('click', () => {
  try {
    runDemo();
  } catch (e) {
    console.error(e);
    alert(e instanceof Error ? e.message : String(e));
  }
});

