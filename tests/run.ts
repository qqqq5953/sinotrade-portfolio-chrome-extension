import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  computePortfolioVsVtiSeries,
  parseNumberStrict,
  parseYahooChartToPriceSeries,
  toIsoDateETFromYmdSlash
} from '../src/core';
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

