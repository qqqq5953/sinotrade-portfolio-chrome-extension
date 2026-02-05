import type { ComputedSeries } from './types';

export function buildEchartsOption(series: ComputedSeries): any {
  return {
    title: { text: 'Portfolio vs VTI' },
    tooltip: { trigger: 'axis' },
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

