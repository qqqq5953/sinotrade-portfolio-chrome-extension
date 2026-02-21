import * as echarts from 'echarts';
import { buildEchartsOption, type ComputedSeries } from '../core';
import { mustQuery } from './dom';
import { WRAPPER_ID } from './tableMount';

function ensureChartContainer(): HTMLDivElement {
  const tagArea = mustQuery<HTMLElement>(document, '#TagSelectArea');
  const existing = document.querySelector('#chart') as HTMLDivElement | null;
  if (existing) return existing;

  const div = document.createElement('div');
  div.id = 'chart';
  div.style.width = '100%';
  div.style.height = '400px';

  const wrapper = document.getElementById(WRAPPER_ID);
  if (wrapper) {
    wrapper.appendChild(div);
    return div;
  }
  const children = Array.from(tagArea.children);
  const secondChild = children[1] ?? null;
  if (secondChild) tagArea.insertBefore(div, secondChild);
  else tagArea.appendChild(div);
  return div;
}

export type ChartValueMode = 'percent' | 'excess' | 'amount';

export function renderChart(series: ComputedSeries, opts?: { valueMode?: ChartValueMode }): void {
  const container = ensureChartContainer();
  const chart = echarts.init(container);
  chart.setOption(buildEchartsOption(series, opts?.valueMode ? { valueMode: opts.valueMode } : undefined), { notMerge: true });
}

