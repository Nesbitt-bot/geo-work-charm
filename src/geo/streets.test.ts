// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  convertStreets,
  downloadStreets,
  localStreets,
  saveStreetPack,
  savedStreetPacks,
  type StreetPack,
} from "./streets";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => vi.unstubAllGlobals());
it.each([
  [39.984, 116.307],
  [31.2304, 121.4737],
  [22.5431, 114.0579],
])(
  "ships real roads, paths, buildings and names offline at %s,%s",
  async (lat, lng) => {
    const pack = await localStreets(lat, lng);
    expect(pack).not.toBeNull();
    expect(
      pack!.features.some(
        (f) => f.properties.kind === "road" && f.properties.name,
      ),
    ).toBe(true);
    expect(
      pack!.features.some(
        (f) =>
          f.properties.kind === "building" && f.geometry.type === "Polygon",
      ),
    ).toBe(true);
    expect(
      pack!.features.some(
        (f) => f.properties.kind === "place" && f.properties.name,
      ),
    ).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  },
);
it("converts OSM building outlines and road paths without inventing names, and rejects invalid coordinates", () => {
  const features = convertStreets([
    {
      type: "way",
      id: 1,
      tags: { building: "yes", name: "Library" },
      geometry: [
        { lat: 1, lon: 1 },
        { lat: 1, lon: 2 },
        { lat: 2, lon: 2 },
        { lat: 1, lon: 1 },
      ],
    },
    {
      type: "way",
      id: 2,
      tags: { highway: "footway" },
      geometry: [
        { lat: 1, lon: 1 },
        { lat: 2, lon: 2 },
      ],
    },
    { type: "node", id: 3, tags: { name: "Invalid" }, lat: 100, lon: 0 },
  ]);
  expect(features).toHaveLength(2);
  expect(features[0].geometry.type).toBe("Polygon");
  expect(features[0].properties.name).toBe("Library");
  expect(features[1].properties).toMatchObject({
    kind: "road",
    name: "",
    highway: "footway",
  });
});
it("caches only three regional packs and reloads them locally; unknown regions stay explicit", async () => {
  for (let i = 0; i < 4; i++)
    saveStreetPack({
      type: "FeatureCollection",
      id: `region-${i}`,
      bbox: [i, 10, i + 0.1, 10.1],
      features: [],
      attribution: "OSM",
    } as StreetPack);
  expect(savedStreetPacks()).toHaveLength(3);
  expect((await localStreets(3.05, 10.05))?.id).toBe("region-3");
  expect(await localStreets(-33, 150)).toBeNull();
  localStorage.setItem("gw:street-packs", "broken");
  expect(savedStreetPacks()).toEqual([]);
});
it("downloads bounded OSM detail, handles a failed GET via POST, and refuses incomplete responses", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response("", { status: 504 }));
  vi.mocked(fetch).mockImplementation(
    async () =>
      new Response(
        JSON.stringify({
          elements: [
            {
              type: "node",
              id: 1,
              lat: 39.984,
              lon: 116.307,
              tags: { name: "Place" },
            },
          ],
        }),
      ),
  );
  const pack = await downloadStreets(
    39.984,
    116.307,
    new AbortController().signal,
  );
  expect(pack.features).toHaveLength(3);
  expect(vi.mocked(fetch).mock.calls[1][1]?.method).toBe("POST");
  expect(vi.mocked(fetch).mock.calls[0][0]).toContain("39.980");
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(JSON.stringify({ elements: [], remark: "timed out" })),
  );
  await expect(
    downloadStreets(39.984, 116.307, new AbortController().signal),
  ).rejects.toThrow(/incomplete/);
});
