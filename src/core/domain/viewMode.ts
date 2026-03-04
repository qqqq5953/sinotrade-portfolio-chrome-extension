import type { TradeEvent } from './types';

/**
 * Extracts unique years from BUY events, sorted ascending.
 * Used to populate the ViewMode year buttons (全部期間 + 各年度).
 */
export function getYearsFromEvents(events: TradeEvent[]): number[] {
  const buyOnly = events.filter((e) => e.type === 'BUY');
  if (buyOnly.length === 0) return [];
  const years = new Set<number>();
  for (const e of buyOnly) {
    const y = parseInt(String(e.isoDateET).slice(0, 4), 10);
    if (Number.isFinite(y)) years.add(y);
  }
  return [...years].sort((a, b) => a - b);
}
