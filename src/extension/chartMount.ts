import * as echarts from 'echarts';
import { buildEchartsOption, type ComputedSeries } from '../core';
import { mustQuery } from './dom';
import { WRAPPER_ID } from './ui/extensionUI';

function ensureChartContainer(): HTMLDivElement {
  const tagArea = mustQuery<HTMLElement>(document, '#TagSelectArea');
  const existing = document.querySelector('#chart') as HTMLDivElement | null;
  if (existing) return existing;

  const div = document.createElement('div');
  div.id = 'chart';
  div.style.width = '100%';
  div.style.height = '400px';
  div.style.padding = '8px 4px';

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

export function renderChart(
  series: ComputedSeries,
  opts?: { valueMode?: ChartValueMode; title?: string; subtext?: string; useDataZoom?: boolean }
): void {
  const container = ensureChartContainer();
  const chart = echarts.init(container);
  const buildOpts: Parameters<typeof buildEchartsOption>[1] = {};
  if (opts?.valueMode) buildOpts.valueMode = opts.valueMode;
  if (opts?.title) buildOpts.title = opts.title;
  if (opts?.subtext !== undefined) buildOpts.subtext = opts.subtext;
  if (opts?.useDataZoom !== undefined) buildOpts.useDataZoom = opts.useDataZoom;
  chart.setOption(buildEchartsOption(series, buildOpts), { notMerge: true });
}

