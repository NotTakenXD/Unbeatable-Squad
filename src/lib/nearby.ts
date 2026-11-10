// "Nearby" for Islamabad: sectors form a grid (letter = row, number = column),
// each roughly 2 km across. Distance between two sectors is the grid distance.
// Names we can't place (e.g. Rawalpindi neighbourhoods) only match exactly.
const SECTOR = /^\s*([D-I])\s*-?\s*(\d{1,2})/i;
const KM_PER_SECTOR = 2;

function parse(area: string) {
  const m = area.match(SECTOR);
  if (!m) return null;
  return { row: m[1].toUpperCase().charCodeAt(0) - 68, col: Number(m[2]) };
}

/** Approximate km between two areas, or null if we can't tell. */
export function areaDistanceKm(a: string, b: string): number | null {
  if (!a.trim() || !b.trim()) return null;
  if (a.trim().toLowerCase() === b.trim().toLowerCase()) return 0;
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return null;
  return Math.round(Math.hypot(pa.row - pb.row, pa.col - pb.col) * KM_PER_SECTOR);
}

/** Closest distance from the customer's area to any area the worker serves. */
export function workerDistanceKm(customerArea: string, workerAreas: (string | null)[]): number | null {
  let best: number | null = null;
  for (const area of workerAreas) {
    if (!area) continue;
    const d = areaDistanceKm(customerArea, area);
    if (d != null && (best == null || d < best)) best = d;
  }
  return best;
}
