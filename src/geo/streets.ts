import type { Feature, FeatureCollection, Geometry } from "geojson";
import { validCoordinate } from "../core/geofence";

export interface StreetProperties {
  name: string;
  kind: "road" | "building" | "water" | "place";
  highway?: string;
}
export interface StreetPack extends FeatureCollection<
  Geometry,
  StreetProperties
> {
  id: string;
  bbox: [number, number, number, number];
  timestamp?: string;
  attribution: string;
}
interface OSMElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}
const packKey = "gw:street-packs";
function contains(pack: StreetPack, lat: number, lng: number) {
  const [south, west, north, east] = pack.bbox;
  return lat >= south && lat <= north && lng >= west && lng <= east;
}
export function convertStreets(
  elements: OSMElement[],
): Feature<Geometry, StreetProperties>[] {
  return elements.flatMap((element) => {
    const tags = element.tags ?? {};
    const kind =
      element.type === "node"
        ? "place"
        : tags.highway
          ? "road"
          : tags.building
            ? "building"
            : tags.waterway || tags.natural === "water"
              ? "water"
              : "place";
    const properties: StreetProperties = {
      name: tags.name || tags["name:en"] || "",
      kind,
      highway: tags.highway,
    };
    if (element.type === "node") {
      return validCoordinate(element.lat ?? NaN, element.lon ?? NaN)
        ? [
            {
              type: "Feature",
              properties,
              geometry: {
                type: "Point",
                coordinates: [element.lon!, element.lat!],
              },
            } as Feature<Geometry, StreetProperties>,
          ]
        : [];
    }
    if (
      !element.geometry ||
      element.geometry.length < 2 ||
      !element.geometry.every((p) => validCoordinate(p.lat, p.lon))
    )
      return [];
    const coordinates = element.geometry.map((p) => [p.lon, p.lat]);
    const closed =
      coordinates.length >= 4 &&
      coordinates[0].every((n, i) => n === coordinates.at(-1)![i]);
    const polygon =
      closed && (kind === "building" || (kind === "water" && !tags.waterway));
    return [
      {
        type: "Feature",
        properties,
        geometry: polygon
          ? { type: "Polygon", coordinates: [coordinates] }
          : { type: "LineString", coordinates },
      } as Feature<Geometry, StreetProperties>,
    ];
  });
}
// Packs are compact regional extracts, bounded to three downloads in browser storage.
export function savedStreetPacks(): StreetPack[] {
  try {
    const packs = JSON.parse(localStorage.getItem(packKey) || "[]");
    return Array.isArray(packs)
      ? packs
          .filter(
            (p) =>
              p?.type === "FeatureCollection" &&
              Array.isArray(p.features) &&
              Array.isArray(p.bbox) &&
              p.bbox.length === 4 &&
              p.bbox.every(Number.isFinite),
          )
          .slice(0, 3)
      : [];
  } catch {
    return [];
  }
}
export function saveStreetPack(pack: StreetPack): boolean {
  try {
    localStorage.setItem(
      packKey,
      JSON.stringify(
        [pack, ...savedStreetPacks().filter((p) => p.id !== pack.id)].slice(
          0,
          3,
        ),
      ),
    );
    return true;
  } catch {
    return false;
  }
}
export async function localStreets(
  lat: number,
  lng: number,
): Promise<StreetPack | null> {
  const cached = savedStreetPacks().find((p) => contains(p, lat, lng));
  if (cached) return cached;
  // Dynamic imports are precached by the app-shell worker for offline startup.
  const loaders = [
    { lat: 39.984, lng: 116.307, load: () => import("./data/beijing.json") },
    { lat: 31.2304, lng: 121.4737, load: () => import("./data/shanghai.json") },
    { lat: 22.5431, lng: 114.0579, load: () => import("./data/shenzhen.json") },
  ];
  const region = loaders.find(
    (p) => Math.abs(lat - p.lat) < 0.006 && Math.abs(lng - p.lng) < 0.008,
  );
  if (!region) return null;
  const pack = (await region.load()).default as unknown as StreetPack;
  return contains(pack, lat, lng) ? pack : null;
}
export async function downloadStreets(
  lat: number,
  lng: number,
  signal: AbortSignal,
): Promise<StreetPack> {
  if (!validCoordinate(lat, lng) || Math.abs(lat) > 85)
    throw Error(
      "Street detail requires a location between 85° south and north.",
    );
  const bbox = [lat - 0.004, lng - 0.004, lat + 0.004, lng + 0.004].map((n) =>
    Number(n.toFixed(3)),
  ) as StreetPack["bbox"];
  const box = bbox.map((n) => n.toFixed(3)).join(",");
  const elements: OSMElement[] = [];
  let timestamp: string | undefined;
  // Small independent requests are more reliable than one large union query.
  // No autocomplete, continuous polling, or global tile scraping.
  for (const filter of ["way[highway]", "way[building]", "node[name]"]) {
    const query = `[out:json][timeout:20];${filter}(${box});out geom;`;
    let response = await fetch(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.any([signal, AbortSignal.timeout(25000)]),
      },
    );
    if (!response.ok && !signal.aborted) {
      response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.any([signal, AbortSignal.timeout(25000)]),
      });
    }
    if (!response.ok)
      throw Error(
        `Street download unavailable (HTTP ${response.status}). Try again later or use online tiles.`,
      );
    const data = await response.json();
    if (!Array.isArray(data.elements) || data.remark)
      throw Error("Street download incomplete. Try again later.");
    elements.push(...data.elements);
    timestamp = data.osm3s?.timestamp_osm_base;
  }
  const features = convertStreets(elements);
  if (!features.length)
    throw Error("OpenStreetMap has no street detail for this area.");
  return {
    type: "FeatureCollection",
    id: `${lat.toFixed(4)},${lng.toFixed(4)}`,
    bbox,
    features,
    timestamp,
    attribution: "© OpenStreetMap contributors · ODbL 1.0",
  };
}
