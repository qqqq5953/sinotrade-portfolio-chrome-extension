import * as echarts from 'echarts';
import { buildEchartsOption, type ComputedSeries } from '../core';
import { mustQuery } from './dom';

function ensureChartContainer(): HTMLDivElement {
  const tagArea = mustQuery<HTMLElement>(document, '#TagSelectArea');
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

export function renderChart(series: ComputedSeries): void {
  const container = ensureChartContainer();
  const chart = echarts.init(container);
  chart.setOption(buildEchartsOption(series), { notMerge: true });
}

