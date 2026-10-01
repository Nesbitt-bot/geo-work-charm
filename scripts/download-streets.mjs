import { mkdir, readFile, writeFile } from "node:fs/promises";

// Reproducible, bounded OSM extracts for the public demo locations. ODbL.
const regions = [
  ["beijing", 39.984, 116.307],
  ["shanghai", 31.2304, 121.4737],
  ["shenzhen", 22.5431, 114.0579],
];
await mkdir("src/geo/data", { recursive: true });
await mkdir("scripts/osm-cache", { recursive: true });
for (const [id, lat, lng] of regions) {
  const bbox = [lat - 0.004, lng - 0.004, lat + 0.004, lng + 0.004].map((n) =>
    Number(n.toFixed(3)),
  );
  const box = bbox.map((n) => n.toFixed(3)).join(",");
  let data = { elements: [] };
  for (const filter of ["way[highway]", "way[building]", "node[name]"]) {
    const cachePath = `scripts/osm-cache/${id}-${filter.replace(/\W/g, "")}.json`;
    let part;
    try {
      if (process.argv.includes("--refresh")) throw Error("Refresh requested");
      part = JSON.parse(await readFile(cachePath, "utf8"));
    } catch {
      /* Download missing extract. */
    }
    if (!part) {
      const query = `[out:json][timeout:20];${filter}(${box});out geom;`;
      let response = await fetch(
        "https://overpass-api.de/api/interpreter?data=" +
          encodeURIComponent(query),
        {
          headers: {
            "User-Agent": "GeoWorkCharm/1.0 (offline OSM map demo)",
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(35000),
        },
      );
      if (!response.ok) {
        response = await fetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          headers: {
            "User-Agent": "GeoWorkCharm/1.0 (offline OSM map demo)",
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: "data=" + encodeURIComponent(query),
          signal: AbortSignal.timeout(30000),
        });
      }
      if (!response.ok) throw Error(`${id}: HTTP ${response.status}`);
      part = await response.json();
      if (part.remark) throw Error(`${id}: ${part.remark}`);
      await writeFile(cachePath, JSON.stringify(part));
    }
    data.elements.push(...part.elements);
    data.osm3s = part.osm3s;
    console.log(`${id} ${filter}: ${part.elements.length} elements`);
  }
  const features = data.elements.flatMap((element) => {
    const tags = element.tags ?? {};
    const name = tags.name || tags["name:en"] || "";
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
    const props = {
      name,
      kind,
      ...(tags.highway ? { highway: tags.highway } : {}),
    };
    if (element.type === "node")
      return [
        {
          type: "Feature",
          properties: props,
          geometry: { type: "Point", coordinates: [element.lon, element.lat] },
        },
      ];
    if (!element.geometry?.length) return [];
    const coordinates = element.geometry.map((p) => [
      Number(p.lon.toFixed(6)),
      Number(p.lat.toFixed(6)),
    ]);
    const closed =
      coordinates.length >= 4 &&
      coordinates[0].every((n, i) => n === coordinates.at(-1)[i]);
    const polygon =
      closed && (kind === "building" || (kind === "water" && !tags.waterway));
    return [
      {
        type: "Feature",
        properties: props,
        geometry: {
          type: polygon ? "Polygon" : "LineString",
          coordinates: polygon ? [coordinates] : coordinates,
        },
      },
    ];
  });
  const pack = {
    type: "FeatureCollection",
    id,
    bbox,
    attribution: "© OpenStreetMap contributors · ODbL 1.0",
    timestamp: data.osm3s?.timestamp_osm_base,
    features,
  };
  const output = JSON.stringify(pack);
  await writeFile(`src/geo/data/${id}.json`, output + "\n");
  console.log(
    `${id}: ${features.length} features, ${(output.length / 1024).toFixed(0)} KB`,
  );
}
