/**
 * Chart time range presets: 1m, 6m, YTD, 1y, 3y, max.
 * Bounds are computed from the series' first/last dates (last = "as of" date).
 */

export type ChartTimeRange = '1m' | '6m' | 'ytd' | '1y' | '3y' | 'max';

/** Add months to an ISO date (YYYY-MM-DD), in UTC calendar. */
function addMonths(iso: string, deltaMonths: number): string {
  const parts = iso.split('-').map(Number);
  const y = parts[0] ?? 0;
  const m = (parts[1] ?? 1) - 1;
  const d = parts[2] ?? 1;
  const date = new Date(Date.UTC(y, m + deltaMonths, d));
  return date.toISOString().slice(0, 10);
}

/**
 * Returns startIso and endIso for the given preset.
 * Uses firstIso/lastIso from the full series (lastIso = "as of" for rolling ranges).
 */
export function getTimeRangeBounds(
  range: ChartTimeRange,
  firstIso: string,
  lastIso: string
): { startIso: string; endIso: string } {
  const endIso = lastIso;
  switch (range) {
    case 'max':
      return { startIso: firstIso, endIso };
    case 'ytd': {
      const y = endIso.slice(0, 4);
      const startIso = `${y}-01-01`;
      return { startIso: startIso < firstIso ? firstIso : startIso, endIso };
    }
    case '1m': {
      const startIso = addMonths(endIso, -1);
      return { startIso: startIso < firstIso ? firstIso : startIso, endIso };
    }
    case '6m': {
      const startIso = addMonths(endIso, -6);
      return { startIso: startIso < firstIso ? firstIso : startIso, endIso };
    }
    case '1y': {
      const startIso = addMonths(endIso, -12);
      return { startIso: startIso < firstIso ? firstIso : startIso, endIso };
    }
    case '3y': {
      const startIso = addMonths(endIso, -36);
      return { startIso: startIso < firstIso ? firstIso : startIso, endIso };
    }
    default:
      return { startIso: firstIso, endIso };
  }
}
