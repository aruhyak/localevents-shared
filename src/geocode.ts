/**
 * Address → coordinates, and back.
 *
 * Uses Nominatim (OpenStreetMap's own geocoder): free, no API key, no billing
 * account. Google's Geocoding API would need a key and a card on file.
 *
 * Nominatim's policy caps use at roughly one request a second and requires an
 * identifying User-Agent or Referer. That rules it out for map tiles — which
 * fire hundreds of requests per view — but it is entirely appropriate here,
 * where a request happens only when someone types an address and presses
 * search.
 *
 * Phase 2 proxies this through the BFF so results are cached and we aren't
 * leaning on a free public service from every client.
 */

export interface GeoResult {
  lat: number;
  lng: number;
  /** Short, human label — "Kerr Park, Downingtown". */
  label: string;
  /** Full formatted address as the geocoder returned it. */
  address: string;
}

const NOMINATIM = 'https://nominatim.openstreetmap.org';

/** Nominatim rejects bursts, so serialise and space out requests. */
let lastCall = 0;
async function throttle() {
  const wait = 1100 - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

function shortLabel(d: Record<string, unknown>): string {
  const a = (d.address ?? {}) as Record<string, string>;
  const what =
    a.amenity ?? a.leisure ?? a.building ?? a.shop ?? a.road ?? a.neighbourhood ?? '';
  const where = a.town ?? a.city ?? a.village ?? a.hamlet ?? a.suburb ?? a.county ?? '';
  if (what && where) return `${what}, ${where}`;
  return what || where || String(d.display_name ?? '').split(',').slice(0, 2).join(',');
}

/**
 * Search an address or place name.
 *
 * `near` biases results toward the user rather than returning a same-named
 * street on the other side of the country — the single most common complaint
 * about naive geocoding.
 */
export async function geocodeAddress(
  query: string,
  near?: { lat: number; lng: number },
): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  await throttle();

  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '5',
    countrycodes: 'us',
  });
  if (near) {
    // ~0.7° box around the user, results inside it ranked first.
    const d = 0.7;
    params.set('viewbox', `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
    params.set('bounded', '0');
  }

  try {
    const res = await fetch(`${NOMINATIM}/search?${params}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as Record<string, unknown>[];
    return rows
      .map((d) => ({
        lat: Number(d.lat),
        lng: Number(d.lon),
        label: shortLabel(d),
        address: String(d.display_name ?? ''),
      }))
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
  } catch {
    return [];
  }
}

/** Coordinates → address, for labelling a dropped pin. */
export async function reverseGeocode(lat: number, lng: number): Promise<GeoResult | null> {
  await throttle();
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'jsonv2',
    addressdetails: '1',
    zoom: '18',
  });
  try {
    const res = await fetch(`${NOMINATIM}/reverse?${params}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const d = (await res.json()) as Record<string, unknown>;
    if (!d || d.error) return null;
    return {
      lat,
      lng,
      label: shortLabel(d),
      address: String(d.display_name ?? ''),
    };
  } catch {
    return null;
  }
}
