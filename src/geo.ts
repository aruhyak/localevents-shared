/**
 * Distance maths for the mock feed.
 *
 * In phase 2 this is replaced by PostGIS `ST_DWithin` on a GiST index, which
 * filters by radius BEFORE sorting — so distance is never computed across the
 * whole table. This file exists only so phase 1 runs with no backend.
 */

const EARTH_RADIUS_KM = 6371;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance in kilometres. */
export function haversineKm(
  aLat: number, aLng: number,
  bLat: number, bLng: number,
): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** "400 m" under a kilometre, "1.2 km" above. */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000 / 50) * 50} m`;
  return `${km.toFixed(1)} km`;
}

/** "in 2 hours", "tomorrow", "Sat 14 Mar" — relative where it helps, absolute where it doesn't. */
export function formatWhen(iso: string, now = new Date()): string {
  const then = new Date(iso);
  const diffMs = then.getTime() - now.getTime();
  const diffH = diffMs / 3_600_000;

  if (diffMs < 0) return 'ended';
  if (diffH < 1) return `in ${Math.max(1, Math.round(diffMs / 60_000))} min`;
  if (diffH < 8) return `in ${Math.round(diffH)} h`;

  const sameDay = then.toDateString() === now.toDateString();
  if (sameDay) return `today ${timeOf(then)}`;

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (then.toDateString() === tomorrow.toDateString()) return `tomorrow ${timeOf(then)}`;

  if (diffH < 24 * 7) {
    return `${then.toLocaleDateString('en-US', { weekday: 'short' })} ${timeOf(then)}`;
  }
  return then.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

function timeOf(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    .replace(':00', '')
    .toLowerCase()
    .replace(' ', '');
}

/** "Aug 15 – 22" for a request's date range. */
export function formatRange(fromIso: string, toIso: string): string {
  const f = new Date(fromIso);
  const t = new Date(toIso);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (f.toDateString() === t.toDateString()) return fmt(f);
  return `${fmt(f)} – ${t.toLocaleDateString('en-US', { day: 'numeric' })}`;
}
