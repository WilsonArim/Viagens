interface NominatimEntry {
  lat: string;
  lon: string;
  display_name: string;
}

export interface GeocodedLocation {
  query: string;
  lat: number;
  lng: number;
  displayName: string;
}

declare global {
  var nominatimCache: Map<string, GeocodedLocation | null> | undefined;
}

const MAX_CACHE_SIZE = 500;
const cache = global.nominatimCache ?? new Map<string, GeocodedLocation | null>();

if (!global.nominatimCache) {
  global.nominatimCache = cache;
}

function cacheSet(key: string, value: GeocodedLocation | null) {
  if (cache.size >= MAX_CACHE_SIZE) {
    // Evict oldest entry (first inserted in Map iteration order)
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function geocodeQuery(query: string): Promise<GeocodedLocation | null> {
  const safeQuery = query.trim().slice(0, 180);
  const normalized = normalizeQuery(safeQuery);
  if (!normalized) {
    return null;
  }

  if (cache.has(normalized)) {
    return cache.get(normalized) ?? null;
  }

  const params = new URLSearchParams({
    q: safeQuery,
    format: "jsonv2",
    limit: "1",
    addressdetails: "0",
  });

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        "Accept-Language": "pt-PT,pt,en",
        "User-Agent": process.env.NOMINATIM_USER_AGENT ?? "amigo-de-viagens/1.0 (contact: dev@example.com)",
      },
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      cacheSet(normalized, null);
      return null;
    }

    const data = (await response.json()) as NominatimEntry[];
    const first = data[0];

    if (!first) {
      cacheSet(normalized, null);
      return null;
    }

    const lat = Number(first.lat);
    const lng = Number(first.lon);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      cacheSet(normalized, null);
      return null;
    }

    const result: GeocodedLocation = {
      query: safeQuery,
      lat,
      lng,
      displayName: first.display_name,
    };

    cacheSet(normalized, result);
    return result;
  } catch {
    cacheSet(normalized, null);
    return null;
  }
}

export async function geocodeQueries(
  queries: string[],
  options: { maxQueries?: number } = {},
): Promise<GeocodedLocation[]> {
  const maxQueries = options.maxQueries ?? 20;
  const uniqueQueries: string[] = [];
  const seen = new Set<string>();

  for (const raw of queries) {
    const query = raw.trim();
    if (!query) {
      continue;
    }

    const normalized = normalizeQuery(query);
    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    uniqueQueries.push(query);

    if (uniqueQueries.length >= maxQueries) {
      break;
    }
  }

  const locations: GeocodedLocation[] = [];

  for (let i = 0; i < uniqueQueries.length; i += 1) {
    const location = await geocodeQuery(uniqueQueries[i]);
    if (location) {
      locations.push(location);
    }

    if (i < uniqueQueries.length - 1) {
      await sleep(250);
    }
  }

  return locations;
}
