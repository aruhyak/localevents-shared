/**
 * Address → coordinates, and back.
 *
 * Photon (Komoot) rather than Nominatim or Google:
 *   Google      needs an API key and a card on file
 *   Nominatim   requires an identifying User-Agent, and browsers FORBID
 *               setting that header from fetch — so it rejects browser calls
 *   Photon      free, keyless, no UA requirement, and built for
 *               search-as-you-type, which is exactly this use case
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

const PHOTON = 'https://photon.komoot.io';

/** Be a polite client — space out requests rather than bursting. */
let lastCall = 0;
async function throttle() {
  const wait = 350 - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | undefined>;
}

function toResult(f: PhotonFeature): GeoResult | null {
  const [lng, lat] = f.geometry?.coordinates ?? [];
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const p = f.properties ?? {};
  const what = p.name ?? [p.housenumber, p.street].filter(Boolean).join(' ');
  const where = p.city ?? p.town ?? p.village ?? p.county ?? '';
  const label = [what, where].filter(Boolean).join(', ') || (p.state ?? 'Unknown place');
  const address = [what, p.street, where, p.state, p.postcode]
    .filter(Boolean)
    .join(', ');
  return { lat: lat as number, lng: lng as number, label, address };
}

/**
 * Search an address or place name.
 *
 * `near` biases results toward the user rather than returning a same-named
 * street on the other side of the country — the most common complaint about
 * naive geocoding.
 */
export async function geocodeAddress(
  query: string,
  near?: { lat: number; lng: number },
): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  await throttle();

  const params = new URLSearchParams({ q, limit: '5', lang: 'en' });
  if (near) {
    params.set('lat', String(near.lat));
    params.set('lon', String(near.lng));
  }

  try {
    const res = await fetch(`${PHOTON}/api/?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { features?: PhotonFeature[] };
    return (data.features ?? []).map(toResult).filter((r): r is GeoResult => r !== null);
  } catch {
    return [];
  }
}

/** Coordinates → address, for labelling a dropped pin. */
export async function reverseGeocode(lat: number, lng: number): Promise<GeoResult | null> {
  await throttle();
  const params = new URLSearchParams({ lat: String(lat), lon: String(lng), lang: 'en' });
  try {
    const res = await fetch(`${PHOTON}/reverse?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: PhotonFeature[] };
    const first = data.features?.[0];
    if (!first) return null;
    const r = toResult(first);
    // Keep the caller's exact coordinates — they dropped the pin, not us.
    return r ? { ...r, lat, lng } : null;
  } catch {
    return null;
  }
}
