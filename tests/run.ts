import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  computePortfolioVsVtiSeries,
  normalizeBuyEventsBySplits,
  parseNumberStrict,
  parseYahooChartSplits,
  parseYahooChartToPriceSeries,
  parseYahooChartToPriceSeriesPair,
  toIsoDateETFromYmdSlash
} from '../src/core';
import type { YahooSplitEvent } from '../src/core';
import type { PriceSeries, TradeEvent } from '../src/core/types';

type TestFn = () => void | Promise<void>;
const tests: { name: string; fn: TestFn }[] = [];

function test(name: string, fn: TestFn): void {
  tests.push({ name, fn });
}

function approxEqual(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps;
}

test('parseNumberStrict handles commas and decimals', () => {
  assert.equal(parseNumberStrict('1,572.66'), 1572.66);
  assert.equal(parseNumberStrict('0.10730'), 0.1073);
});

test('toIsoDateETFromYmdSlash normalizes date', () => {
  assert.equal(toIsoDateETFromYmdSlash('2024/12/30'), '2024-12-30');
  assert.equal(toIsoDateETFromYmdSlash('2024-1-2'), '2024-01-02');
});

test('parseYahooChartToPriceSeries prefers adjclose by default', async () => {
  const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'yahoo.sample.json');
  const json = JSON.parse(await readFile(fixturePath, 'utf8'));
  const ps = parseYahooChartToPriceSeries('VTI', json, { preferAdjClose: true });
  // The fixture contains one day where close=100 but adjclose=101.
  assert.equal(ps.get('2024-01-02'), 101);
});

test('parseYahooChartToPriceSeriesPair returns both close and adjclose maps', async () => {
  const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'yahoo.sample.json');
  const json = JSON.parse(await readFile(fixturePath, 'utf8'));
  const pair = parseYahooChartToPriceSeriesPair('VTI', json);
  assert.equal(pair.close.get('2024-01-02'), 100);
  assert.equal(pair.adjclose.get('2024-01-02'), 101);
  assert.equal(pair.close.get('2024-01-03'), 102);
  assert.equal(pair.adjclose.get('2024-01-03'), 103);
});

test('parseYahooChartSplits parses and sorts split events with factors', () => {
  const json = {
    chart: {
      result: [
        {
          timestamp: [1704171600],
          events: {
            splits: {
              // Intentionally out-of-order object keys; parser should sort by date asc.
              '1718026200': {
                date: 1718026200,
                numerator: 10,
                denominator: 1,
                splitRatio: '10:1'
              },
              '1626787800': {
                date: 1626787800,
                numerator: 4,
                denominator: 1,
                splitRatio: '4:1'
              },
              '1189492200': {
                date: 1189492200,
                numerator: 1.5,
                denominator: 1,
                splitRatio: '1.5:1'
              }
            }
          },
          indicators: { quote: [{ close: [100] }] }
        }
      ],
      error: null
    }
  };

  const splits = parseYahooChartSplits('NVDA', json);
  assert.equal(splits.length, 3);
  assert.ok((splits[0]?.date ?? 0) < (splits[1]?.date ?? 0));
  assert.ok((splits[1]?.date ?? 0) < (splits[2]?.date ?? 0));
  assert.equal(splits[0]?.splitRatio, '1.5:1');
  assert.equal(splits[0]?.factor, 1.5);
  assert.equal(splits[1]?.splitRatio, '4:1');
  assert.equal(splits[1]?.factor, 4);
  assert.equal(splits[2]?.splitRatio, '10:1');
  assert.equal(splits[2]?.factor, 10);
});

test('parseYahooChartSplits returns empty array when no split events', async () => {
  const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'yahoo.sample.json');
  const json = JSON.parse(await readFile(fixturePath, 'utf8'));
  const splits = parseYahooChartSplits('VTI', json);
  assert.deepEqual(splits, []);
});

test('normalizeBuyEventsBySplits applies x40/x10 and keeps same-day split unapplied', () => {
  const events: TradeEvent[] = [
    {
      type: 'BUY',
      tradeDate: '2020/01/10',
      isoDateET: '2020-01-10',
      ticker: 'NVDA',
      shares: 1,
      cash: 100,
      sourceYear: 2020
    },
    {
      type: 'BUY',
      tradeDate: '2022/07/26',
      isoDateET: '2022-07-26',
      ticker: 'NVDA',
      shares: 2,
      cash: 100,
      sourceYear: 2022
    },
    {
      type: 'BUY',
      tradeDate: '2024/06/10',
      isoDateET: '2024-06-10',
      ticker: 'NVDA',
      shares: 3,
      cash: 100,
      sourceYear: 2024
    }
  ];

  const splitsByTicker = new Map<string, YahooSplitEvent[]>([
    [
      'NVDA',
      [
        { isoDateET: '2021-07-20', factor: 4, date: 1626787800, splitRatio: '4:1' },
        { isoDateET: '2024-06-10', factor: 10, date: 1718026200, splitRatio: '10:1' }
      ]
    ]
  ]);

  const out = normalizeBuyEventsBySplits(events, splitsByTicker);
  // Before 2021 split => 4 * 10 = 40x
  assert.equal(out[0]?.shares, 40);
  assert.equal(out[0]?.splitFactorApplied, 40);
  assert.deepEqual(out[0]?.splitAppliedChain, ['2021-07-20 x4', '2024-06-10 x10']);

  // Between 2021 and 2024 split => 10x
  assert.equal(out[1]?.shares, 20);
  assert.equal(out[1]?.splitFactorApplied, 10);
  assert.deepEqual(out[1]?.splitAppliedChain, ['2024-06-10 x10']);

  // Same day as split => not applied (strictly greater only)
  assert.equal(out[2]?.shares, 3);
  assert.equal(out[2]?.splitFactorApplied, undefined);
});

test('normalizeBuyEventsBySplits only affects BUY and matching ticker', () => {
  const events: TradeEvent[] = [
    {
      type: 'BUY',
      tradeDate: '2022/01/01',
      isoDateET: '2022-01-01',
      ticker: 'NVDA',
      shares: 1,
      cash: 100,
      sourceYear: 2022
    },
    {
      type: 'SELL',
      tradeDate: '2022/01/02',
      isoDateET: '2022-01-02',
      ticker: 'NVDA',
      shares: 1,
      cash: 100,
      sourceYear: 2022
    },
    {
      type: 'BUY',
      tradeDate: '2022/01/03',
      isoDateET: '2022-01-03',
      ticker: 'AAPL',
      shares: 5,
      cash: 100,
      sourceYear: 2022
    }
  ];
  const splitsByTicker = new Map<string, YahooSplitEvent[]>([
    ['NVDA', [{ isoDateET: '2024-06-10', factor: 10, date: 1718026200, splitRatio: '10:1' }]]
  ]);

  const out = normalizeBuyEventsBySplits(events, splitsByTicker);
  assert.equal(out[0]?.shares, 10); // NVDA BUY adjusted
  assert.equal(out[1]?.shares, 1); // SELL unchanged
  assert.equal(out[2]?.shares, 5); // other ticker unchanged
});

test('computePortfolioVsVtiSeries computes trade-day points with anchor date shift', () => {
  // This fixture intentionally uses an event date that is missing in VTI series,
  // but present on previous trading day -> triggers ET alignment (-1 trading day).
  const events: TradeEvent[] = [
    {
      type: 'BUY',
      tradeDate: '2024/01/03',
      isoDateET: '2024-01-03',
      ticker: 'AAA',
      shares: 1,
      cash: 100,
      sourceYear: 2024
    },
    {
      type: 'SELL',
      tradeDate: '2024/01/10',
      isoDateET: '2024-01-10',
      ticker: 'AAA',
      shares: 1,
      cash: 100,
      sourceYear: 2024
    }
  ];

  const aaa: PriceSeries = new Map([
    ['2024-01-02', 10],
    ['2024-01-10', 12]
  ]);
  const vti: PriceSeries = new Map([
    // Missing 2024-01-03 on purpose; anchor will resolve to 2024-01-02.
    ['2024-01-02', 100],
    ['2024-01-10', 110]
  ]);

  const priceSeriesByTicker = new Map<string, PriceSeries>([
    ['AAA', aaa],
    ['VTI', vti]
  ]);

  const out = computePortfolioVsVtiSeries({ events, priceSeriesByTicker, maxBackTradingDays: 7, anchorTicker: 'VTI' });

  assert.deepEqual(out.resolvedIsoDatesET, ['2024-01-02', '2024-01-10']);

  // Day1: portfolio = 1*10
  assert.equal(out.portfolio[0]?.value, 10);

  // VTI shares after buy: 100/100 = 1; value = 1*100
  assert.equal(out.vti[0]?.value, 100);

  // Day2: holdings reduced to 0 -> portfolio 0
  assert.equal(out.portfolio[1]?.value, 0);

  // VTI shares after sell: 1 - 100/110 = 0.0909..., value ~ 10
  assert.ok(approxEqual(out.vti[1]?.value ?? NaN, 10));
});

test('computePortfolioVsVtiSeries throws if VTI shares would go negative', () => {
  const events: TradeEvent[] = [
    {
      type: 'BUY',
      tradeDate: '2024/01/02',
      isoDateET: '2024-01-02',
      ticker: 'AAA',
      shares: 1,
      cash: 100,
      sourceYear: 2024
    },
    {
      type: 'SELL',
      tradeDate: '2024/01/10',
      isoDateET: '2024-01-10',
      ticker: 'AAA',
      shares: 1,
      cash: 200,
      sourceYear: 2024
    }
  ];

  const aaa: PriceSeries = new Map([
    ['2024-01-02', 10],
    ['2024-01-10', 12]
  ]);
  const vti: PriceSeries = new Map([
    ['2024-01-02', 100],
    ['2024-01-10', 110]
  ]);

  const priceSeriesByTicker = new Map<string, PriceSeries>([
    ['AAA', aaa],
    ['VTI', vti]
  ]);

  assert.throws(() => {
    computePortfolioVsVtiSeries({ events, priceSeriesByTicker, maxBackTradingDays: 7, anchorTicker: 'VTI' });
  });
});

async function run(): Promise<void> {
  let passed = 0;
  const failures: { name: string; error: unknown }[] = [];

  for (const t of tests) {
    try {
      await t.fn();
      passed += 1;
      process.stdout.write(`ok - ${t.name}\n`);
    } catch (e) {
      failures.push({ name: t.name, error: e });
      process.stdout.write(`not ok - ${t.name}\n`);
    }
  }

  process.stdout.write(`\n${passed}/${tests.length} tests passed\n`);

  if (failures.length) {
    for (const f of failures) {
      process.stdout.write(`\n# ${f.name}\n`);
      process.stdout.write(String(f.error instanceof Error ? f.error.stack ?? f.error.message : f.error));
      process.stdout.write('\n');
    }
    process.exitCode = 1;
  }
}

run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

