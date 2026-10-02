// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  coordinatePlace,
  geocodeAddress,
  rememberPlace,
  savedPlaces,
  searchLocalPlaces,
  reversePlace,
} from "./geocode";
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => vi.unstubAllGlobals());
it("labels a dragged point without snapping its coordinates to a nearby address", async () => {
  vi.mocked(fetch).mockResolvedValue(
    new Response(
      JSON.stringify({
        features: [
          {
            geometry: { coordinates: [113, 28] },
            properties: { name: "Office", city: "Changsha" },
          },
        ],
      }),
    ),
  );
  const point = { lat: 28.20546, lng: 112.96593 };
  expect(await reversePlace(point)).toEqual({
    ...point,
    name: "Near Office, Changsha",
  });
  expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain(
    `/reverse?lat=${point.lat}&lon=${point.lng}`,
  );
  expect(savedPlaces()).toEqual([]);
});
it("leaves unnamed points usable and rejects unavailable reverse lookups", async () => {
  vi.mocked(fetch)
    .mockResolvedValueOnce(new Response(JSON.stringify({ features: [] })))
    .mockRejectedValueOnce(Error("offline"));
  expect(await reversePlace({ lat: 28, lng: 113 })).toBeNull();
  await expect(reversePlace({ lat: 28, lng: 113 })).rejects.toThrow("offline");
  expect(await reversePlace({ lat: 95, lng: 113 })).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("has no preset cities or addresses; coordinates and selected history work offline", () => {
  expect(searchLocalPlaces("北京")).toEqual([]);
  expect(savedPlaces()).toEqual([]);
  rememberPlace({
    name: "万达·总部国际·C区",
    lat: 28.2054614,
    lng: 112.965934,
    searchText: "长沙万达总部国际 C区",
  });
  expect(searchLocalPlaces("长沙万达总部国际C区")[0].lat).toBe(28.2054614);
  expect(coordinatePlace("-33.8688，151.2093")).toMatchObject({
    lat: -33.8688,
    lng: 151.2093,
  });
  expect(() => coordinatePlace("91,181")).toThrow(/latitude/);
  expect(fetch).not.toHaveBeenCalled();
});
it("bounds selected-address history, tolerates bad storage, and does not import legacy suggestions", () => {
  localStorage.setItem(
    "gw:places",
    JSON.stringify([{ name: "Old suggestion", lat: 1, lng: 1 }]),
  );
  expect(savedPlaces()).toEqual([]);
  for (let i = 0; i < 90; i++)
    rememberPlace({ name: `Office ${i}`, lat: i, lng: 0 });
  expect(savedPlaces()).toHaveLength(80);
  localStorage.setItem("gw:history", '{"bad":"data"}');
  expect(savedPlaces()).toEqual([]);
});
it("broadens a Chinese POI search and ranks the requested C区 above B区 without adding suggestions to history", async () => {
  vi.mocked(fetch)
    .mockResolvedValueOnce(new Response(JSON.stringify({ features: [] })))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          features: [
            {
              geometry: { coordinates: [112.9657979, 28.2037117] },
              properties: { name: "万达·总部国际·B区", state: "湖南省" },
            },
            {
              geometry: { coordinates: [112.965934, 28.2054614] },
              properties: { name: "万达·总部国际·C区", state: "湖南省" },
            },
          ],
        }),
      ),
    );
  const results = await geocodeAddress("长沙万达总部国际 C区");
  expect(results[0]).toMatchObject({
    name: "万达·总部国际·C区, 湖南省",
    lat: 28.2054614,
    lng: 112.965934,
  });
  expect(
    decodeURIComponent(String(vi.mocked(fetch).mock.calls[1][0])),
  ).toContain("q=万达总部国际");
  expect(savedPlaces()).toEqual([]);
  await geocodeAddress("长沙万达总部国际 C区");
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("rejects invalid provider data and cancelled requests without saving stale results", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response("{}"));
  await expect(geocodeAddress("Example")).rejects.toThrow(/invalid response/);
  const controller = new AbortController();
  controller.abort();
  await expect(geocodeAddress("Late", controller.signal)).rejects.toThrow(
    /cancelled/,
  );
  expect(savedPlaces()).toEqual([]);
});
