// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as L from "leaflet";
import { MapView } from "./Map";
import App from "../App";
import { rememberPlace, savedPlaces } from "../location/geocode";
vi.mock("leaflet", async (original) => {
  const actual = await original<typeof import("leaflet")>();
  return { ...actual, map: vi.fn(actual.map) };
});
const work = {
  code: "CUSTOM:office",
  name: "Office",
  lat: 28.20546,
  lng: 112.96593,
  enter: 80,
  exit: 120,
};
const sample = {
  latitude: work.lat,
  longitude: work.lng,
  accuracy: 15,
  timestamp: 1,
  source: "simulation" as const,
};
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  location.hash = "#/settings";
  vi.mocked(L.map).mockClear();
  Object.defineProperty(L.Browser, "svg", { value: true, configurable: true });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("persists the exact dragged pin, supports map clicks, and shows both workplace ranges", () => {
  const select = vi.fn();
  render(
    <MapView
      work={work}
      sample={sample}
      online={false}
      onSetLocation={select}
    />,
  );
  const map = vi.mocked(L.map).mock.results[0].value as L.Map;
  let marker: L.Marker | undefined;
  const radii: number[] = [];
  map.eachLayer((layer) => {
    if (layer instanceof L.Marker) marker = layer;
    if (layer instanceof L.Circle) radii.push(layer.getRadius());
  });
  expect(radii).toEqual(expect.arrayContaining([80, 120, 15]));
  expect(marker?.dragging?.enabled()).toBe(true);
  act(() => {
    marker!.fire("dragstart");
    marker!.setLatLng([work.lat + 0.002, work.lng + 0.001]);
    marker!.fire("dragend");
  });
  expect(select).toHaveBeenCalledWith({
    lat: work.lat + 0.002,
    lng: expect.closeTo(work.lng + 0.001),
  });
  act(() => map.fire("click", { latlng: L.latLng(work.lat, work.lng) }));
  expect(select).toHaveBeenLastCalledWith({
    lat: work.lat,
    lng: expect.closeTo(work.lng),
  });
  expect(
    screen.getByLabelText("Custom location map: drag pin or click to select"),
  ).toBeTruthy();
});
it("keeps the debugging overview read-only and updates the current position", () => {
  const { rerender } = render(
    <MapView work={work} sample={sample} online={false} />,
  );
  const map = vi.mocked(L.map).mock.results[0].value as L.Map;
  let marker: L.Marker | undefined;
  map.eachLayer((layer) => {
    if (layer instanceof L.Marker) marker = layer;
  });
  expect(marker?.dragging?.enabled()).toBeFalsy();
  rerender(
    <MapView
      work={work}
      sample={{ ...sample, latitude: work.lat + 0.001 }}
      online={false}
    />,
  );
  expect(marker?.getLatLng().lat).toBe(work.lat + 0.001);
});
it("saves a dragged custom point locally and shows it in Debugging without changing company history", () => {
  rememberPlace({ name: work.name, lat: work.lat, lng: work.lng });
  localStorage.setItem(
    "gw:settings",
    JSON.stringify({
      locationSource: "custom",
      searchOnline: false,
      mapOnline: false,
    }),
  );
  render(<App />);
  let marker: L.Marker | undefined;
  const picker = vi.mocked(L.map).mock.results[0].value as L.Map;
  picker.eachLayer((layer) => {
    if (layer instanceof L.Marker) marker = layer;
  });
  act(() => {
    marker!.fire("dragstart");
    marker!.setLatLng([28.21, 112.97]);
    marker!.fire("dragend");
  });
  expect(
    JSON.parse(localStorage.getItem("gw:settings")!).testLocation,
  ).toMatchObject({ lat: 28.21, lng: expect.closeTo(112.97) });
  expect(savedPlaces()).toHaveLength(1);
  fireEvent.click(screen.getByRole("tab", { name: "Debugging" }));
  expect(
    screen.queryByLabelText("Custom location map: drag pin or click to select"),
  ).toBeNull();
  const overview = vi.mocked(L.map).mock.results[1].value as L.Map;
  let current: L.Marker | undefined;
  overview.eachLayer((layer) => {
    if (layer instanceof L.Marker) current = layer;
  });
  expect(current?.getLatLng().lat).toBe(28.21);
  expect(current?.dragging?.enabled()).toBeFalsy();
});
