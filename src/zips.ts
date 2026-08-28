/**
 * Offline zip → coordinates.
 *
 * Phase 1 ships a small table rather than calling a geocoder: it resolves
 * instantly, works offline, needs no key, and can't rate-limit. Nominatim
 * would cover every zip but caps at one request a second and forbids heavy
 * use — the same fragility that made CARTO's tiles fail.
 *
 * Phase 2 replaces `lookupZip` with a BFF call to a real geocoder. The
 * signature stays, so nothing above it changes.
 *
 * Coordinates are approximate centroids — good enough to centre a map and
 * run a radius query, which is all they're used for.
 */

export interface ZipPlace {
  zip: string;
  label: string;
  lat: number;
  lng: number;
}

/** Austin and surrounds — the trial area. */
export const ZIPS: readonly ZipPlace[] = [
  { zip: '78701', label: 'Downtown Austin',    lat: 30.2711, lng: -97.7437 },
  { zip: '78702', label: 'East Austin',        lat: 30.2626, lng: -97.7141 },
  { zip: '78703', label: 'Tarrytown',          lat: 30.2915, lng: -97.7663 },
  { zip: '78704', label: 'Bouldin Creek',      lat: 30.2453, lng: -97.7664 },
  { zip: '78705', label: 'North Campus',       lat: 30.2953, lng: -97.7383 },
  { zip: '78721', label: 'Govalle',            lat: 30.2686, lng: -97.6866 },
  { zip: '78722', label: 'Cherrywood',         lat: 30.2884, lng: -97.7147 },
  { zip: '78723', label: 'Windsor Park',       lat: 30.3068, lng: -97.6866 },
  { zip: '78724', label: 'Colony Park',        lat: 30.2905, lng: -97.6141 },
  { zip: '78727', label: 'North Austin',       lat: 30.4275, lng: -97.7126 },
  { zip: '78731', label: 'Northwest Hills',    lat: 30.3403, lng: -97.7657 },
  { zip: '78735', label: 'Barton Creek',       lat: 30.2536, lng: -97.8523 },
  { zip: '78741', label: 'Riverside',          lat: 30.2278, lng: -97.7146 },
  { zip: '78745', label: 'South Austin',       lat: 30.2071, lng: -97.7936 },
  { zip: '78746', label: 'West Lake Hills',    lat: 30.2905, lng: -97.8062 },
  { zip: '78748', label: 'Southpark Meadows',  lat: 30.1680, lng: -97.8203 },
  { zip: '78749', label: 'Circle C',           lat: 30.2118, lng: -97.8546 },
  { zip: '78751', label: 'Hyde Park',          lat: 30.3079, lng: -97.7235 },
  { zip: '78752', label: 'Highland',           lat: 30.3334, lng: -97.7016 },
  { zip: '78756', label: 'Rosedale',           lat: 30.3208, lng: -97.7396 },
  { zip: '78757', label: 'Crestview',          lat: 30.3499, lng: -97.7318 },
  { zip: '78758', label: 'North Lamar',        lat: 30.3855, lng: -97.7076 },
  { zip: '78759', label: 'Great Hills',        lat: 30.4046, lng: -97.7550 },
  { zip: '78660', label: 'Pflugerville',       lat: 30.4494, lng: -97.6200 },
  { zip: '78664', label: 'Round Rock',         lat: 30.5083, lng: -97.6570 },
  { zip: '78681', label: 'Round Rock West',    lat: 30.5299, lng: -97.7181 },
  { zip: '78613', label: 'Cedar Park',         lat: 30.5052, lng: -97.8203 },
  { zip: '78641', label: 'Leander',            lat: 30.5788, lng: -97.8531 },
  { zip: '78610', label: 'Buda',               lat: 30.0855, lng: -97.8412 },
  { zip: '78640', label: 'Kyle',               lat: 29.9891, lng: -97.8772 },
  { zip: '78666', label: 'San Marcos',         lat: 29.8833, lng: -97.9414 },
  { zip: '78620', label: 'Dripping Springs',   lat: 30.1902, lng: -98.0867 },
  { zip: '78669', label: 'Spicewood',          lat: 30.4746, lng: -98.0400 },
  { zip: '78734', label: 'Lakeway',            lat: 30.3721, lng: -97.9772 },
  { zip: '78652', label: 'Manchaca',           lat: 30.1355, lng: -97.8331 },
];

const BY_ZIP = new Map(ZIPS.map((z) => [z.zip, z]));

/** Digits only, so "78704-1234" and " 78704 " both work. */
export function normaliseZip(input: string): string {
  return input.replace(/[^\d]/g, '').slice(0, 5);
}

export function isValidZipFormat(input: string): boolean {
  return normaliseZip(input).length === 5;
}

/**
 * Local table first, then the network.
 *
 * The table answers instantly and offline for the trial area. Anything else
 * falls back to Zippopotam.us — free, keyless, and covers every US zip, which
 * matters because "not in the trial area" is a baffling message when you just
 * typed your own zip code.
 *
 * Phase 2 replaces the fallback with a BFF call so the lookup is cached
 * server-side and we aren't leaning on a free public service.
 */
export async function lookupZip(input: string): Promise<ZipPlace | null> {
  const zip = normaliseZip(input);
  if (zip.length !== 5) return null;

  const local = BY_ZIP.get(zip);
  if (local) return local;

  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;                    // 404 = not a real US zip
    const data = (await res.json()) as {
      'post code': string;
      places: { 'place name': string; state?: string; latitude: string; longitude: string }[];
    };
    const place = data.places?.[0];
    if (!place) return null;

    const lat = Number(place.latitude);
    const lng = Number(place.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return {
      zip: data['post code'] ?? zip,
      label: place.state ? `${place['place name']}, ${place.state}` : place['place name'],
      lat,
      lng,
    };
  } catch {
    // Offline or timed out. Null reads as "couldn't find it", which is honest
    // — the caller shouldn't have to distinguish the two.
    return null;
  }
}

/** Nearest known place to a coordinate — used to label a GPS fix. */
export function nearestPlace(lat: number, lng: number): ZipPlace {
  let best = ZIPS[0]!;
  let bestD = Number.POSITIVE_INFINITY;
  for (const z of ZIPS) {
    const d = (z.lat - lat) ** 2 + (z.lng - lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = z;
    }
  }
  return best;
}
