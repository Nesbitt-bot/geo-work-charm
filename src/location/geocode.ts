import { validCoordinate, type Workplace } from "../core/geofence";

export interface Place {
  name: string;
  lat: number;
  lng: number;
  searchText?: string;
}
export function workplaceFor(place: Place): Workplace {
  return {
    code: `CUSTOM:${place.lat.toFixed(6)},${place.lng.toFixed(6)}`,
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    enter: 80,
    exit: 120,
  };
}

const storageKey = "gw:history";
function isPlace(value: unknown): value is Place {
  if (!value || typeof value !== "object") return false;
  const p = value as Place;
  return (
    typeof p.name === "string" &&
    Boolean(p.name.trim()) &&
    validCoordinate(p.lat, p.lng)
  );
}
export function savedPlaces(): Place[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(data) ? data.filter(isPlace).slice(0, 80) : [];
  } catch {
    return [];
  }
}
export function rememberPlace(place: Place) {
  if (!isPlace(place)) return;
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify(
        [
          place,
          ...savedPlaces().filter(
            (p) => p.lat !== place.lat || p.lng !== place.lng,
          ),
        ].slice(0, 80),
      ),
    );
  } catch {
    /* Search still works when browser storage is unavailable. */
  }
}
// Coordinate input is explicitly latitude, longitude in WGS84.
export function coordinatePlace(query: string): Place | null {
  const match = query
    .trim()
    .match(/^([+-]?\d+(?:\.\d+)?)\s*[,，]\s*([+-]?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]),
    lng = Number(match[2]);
  if (!validCoordinate(lat, lng))
    throw Error("Use latitude −90 to 90, longitude −180 to 180.");
  return { name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng };
}
export const normalizeSearch = (value: string) =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s·•,，。]/g, "");
export function searchLocalPlaces(query: string): Place[] {
  const coordinate = coordinatePlace(query);
  if (coordinate) return [coordinate];
  const needle = normalizeSearch(query);
  const seen = new Set<string>();
  return savedPlaces()
    .filter((p) => {
      const key = `${p.lat},${p.lng}`;
      const text = normalizeSearch(`${p.name} ${p.searchText ?? ""}`);
      if (seen.has(key) || !text.includes(needle)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}
function queriesFor(query: string): string[] {
  const plain = query.normalize("NFKC").replace(/[·•]/g, "").trim();
  const base = plain.replace(/\s*[A-Za-z]\s*[区座栋楼]\s*$/, "").trim();
  // Chinese POIs often live under district tags rather than the city in OSM.
  // Try the POI after a city prefix only if the full address returned no match.
  const withoutCity = base.replace(/^[\u4e00-\u9fff]{2,5}市/, "");
  const tail =
    withoutCity === base && /^[\u4e00-\u9fff]{5,}/.test(base)
      ? base.slice(2)
      : withoutCity;
  return [...new Set([plain, tail, base])].filter(Boolean).slice(0, 3);
}
async function photon(query: string, signal?: AbortSignal): Promise<Place[]> {
  const response = await fetch(
    `https://photon.komoot.io/api/?q=${encodeURIComponent(query.trim())}&limit=6`,
    {
      headers: {
        Accept: "application/json",
        "Accept-Language": /[\u4e00-\u9fff]/.test(query)
          ? "zh-CN,zh;q=0.9"
          : "en",
      },
      signal: AbortSignal.any([
        AbortSignal.timeout(8000),
        ...(signal ? [signal] : []),
      ]),
    },
  );
  if (!response.ok)
    throw Error(
      "Online search unavailable. Use saved places, coordinates, or pick on the map.",
    );
  const data = await response.json();
  if (!Array.isArray(data.features))
    throw Error("Address service returned an invalid response.");
  const results: Place[] = [];
  for (const feature of data.features) {
    const coords = feature?.geometry?.coordinates;
    const p = feature?.properties;
    if (!Array.isArray(coords) || !validCoordinate(coords[1], coords[0]) || !p)
      continue;
    const street = [p.housenumber, p.street]
      .filter((v) => typeof v === "string")
      .join(" ");
    const name = [
      ...new Set(
        [p.name, street, p.district, p.city, p.state, p.country].filter(
          (v) => typeof v === "string" && v,
        ),
      ),
    ].join(", ");
    results.push({
      name: name || `${coords[1]}, ${coords[0]}`,
      lat: coords[1],
      lng: coords[0],
    });
  }
  return results;
}

export async function geocodeAddress(
  query: string,
  signal?: AbortSignal,
): Promise<Place[]> {
  const coordinate = coordinatePlace(query);
  if (coordinate) return [coordinate];
  if (!query.trim()) return [];
  const normalized = normalizeSearch(query);
  const cacheKey = `gw:search:${normalized}`;
  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
    if (cached?.expires > Date.now() && Array.isArray(cached.results))
      return cached.results.filter(isPlace);
  } catch {
    /* Cached suggestions are optional, separate from selected history. */
  }
  let results: Place[] = [];
  for (const candidate of queriesFor(query)) {
    if (signal?.aborted)
      throw new DOMException("Search cancelled", "AbortError");
    results = await photon(candidate, signal);
    if (signal?.aborted)
      throw new DOMException("Search cancelled", "AbortError");
    if (results.length) break;
  }
  const zone = normalized.match(/([a-z][区座栋楼])$/)?.[1];
  if (zone)
    results.sort(
      (a, b) =>
        Number(normalizeSearch(b.name).includes(zone)) -
        Number(normalizeSearch(a.name).includes(zone)),
    );
  try {
    sessionStorage.setItem(
      cacheKey,
      JSON.stringify({ results, expires: Date.now() + 300000 }),
    );
  } catch {
    /* Optional cache. */
  }
  return results;
}
