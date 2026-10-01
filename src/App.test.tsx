// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Browser } from "leaflet";
import App from "./App";
import { rememberPlace, workplaceFor } from "./location/geocode";
const office = { name: "万达·总部国际·C区", lat: 28.2054614, lng: 112.965934 };
let success: PositionCallback;
let failure: PositionErrorCallback | undefined;
let count = 0;
let requestedOptions: PositionOptions | undefined;
const watch = vi.fn(
  (
    next: PositionCallback,
    error?: PositionErrorCallback,
    options?: PositionOptions,
  ) => {
    success = next;
    failure = error;
    requestedOptions = options;
    return 42;
  },
);
const clear = vi.fn();
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  rememberPlace(office);
  count = 0;
  Object.defineProperty(Browser, "svg", { value: true, configurable: true });
  Object.defineProperty(navigator, "geolocation", {
    value: { watchPosition: watch, clearWatch: clear },
    configurable: true,
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  watch.mockClear();
  clear.mockClear();
  location.hash = "#/production";
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (navigator as unknown as { geolocation?: unknown }).geolocation;
});
const position = (lat = office.lat, lng = office.lng, accuracy = 15) => {
  success({
    coords: {
      latitude: lat,
      longitude: lng,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: Date.now() + ++count,
  } as GeolocationPosition);
};
const route = async (hash: string) =>
  act(async () => {
    location.hash = hash;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
const tick = async (ms = 2300) =>
  act(async () => {
    vi.advanceTimersByTime(ms);
  });
it("starts browser location before any workplace exists and exposes exactly three navigation links", () => {
  localStorage.clear();
  render(<App />);
  expect(watch).toHaveBeenCalledOnce();
  expect(requestedOptions?.enableHighAccuracy).toBe(true);
  expect(
    within(screen.getByRole("navigation"))
      .getAllByRole("link")
      .map((link) => link.textContent),
  ).toEqual(["Production", "Test", "Settings"]);
  expect(
    screen.getByRole("combobox", { name: "Search your workplace address" }),
  ).toBeTruthy();
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(screen.queryByRole("slider")).toBeNull();
  expect(screen.getByLabelText("Distance").textContent).toContain("—");
});
it("production ignores saved simulation preferences and updates from browser GPS only", async () => {
  localStorage.setItem(
    "gw:settings",
    JSON.stringify({
      provider: "simulation",
      distance: 700,
      testLocation: { name: "Fake", lat: 0, lng: 0 },
    }),
  );
  render(<App />);
  await act(async () => {
    position();
  });
  await act(async () => {
    position();
  });
  expect(screen.getByLabelText("Distance").textContent).toContain("0");
  expect(screen.getByText("Working")).toBeTruthy();
  expect(screen.queryByRole("slider")).toBeNull();
  expect(
    screen
      .getByRole("link", { name: "Open Production fullscreen widget" })
      .getAttribute("href"),
  ).toBe("#/widget/production");
  await act(async () => {
    failure?.({
      message: "Permission denied",
      code: 1,
    } as GeolocationPositionError);
  });
  expect(screen.getByText("Waiting for location")).toBeTruthy();
  expect(screen.getByLabelText("Distance").textContent).toContain("—");
});
it.each([
  [0, "Working"],
  [0.003, "Off work"],
])(
  "classifies a single reliable stationary GPS fix (%s) without waiting for movement",
  async (offset, label) => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => position(office.lat + offset));
    expect(screen.getByText(label)).toBeTruthy();
    await tick(30000);
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByLabelText("Clocking out")).toBeNull();
  },
);
it("retains consecutive fixes when React batches browser callbacks", async () => {
  render(<App />);
  await act(async () => position());
  await act(async () => {
    position(office.lat + 0.003);
    position(office.lat + 0.003);
  });
  expect(screen.getByLabelText("Clocking out")).toBeTruthy();
});
it("ignores duplicate fixes and still confirms departures with two distinct updates", async () => {
  render(<App />);
  const fix = {
    coords: { latitude: office.lat, longitude: office.lng, accuracy: 15 },
    timestamp: Date.now(),
  } as GeolocationPosition;
  await act(async () => success(fix));
  await act(async () => success(fix));
  expect(screen.getByText("Working")).toBeTruthy();
  await act(async () => position(office.lat + 0.003));
  expect(screen.getByText("Working")).toBeTruthy();
  expect(screen.queryByLabelText("Clocking out")).toBeNull();
  await act(async () => position(office.lat + 0.003));
  expect(screen.getByLabelText("Clocking out")).toBeTruthy();
});
it("explains poor accuracy and the hysteresis band instead of claiming location is missing", async () => {
  render(<App />);
  await act(async () => position(office.lat, office.lng, 200));
  expect(screen.getByText("Low location accuracy")).toBeTruthy();
  await act(async () => position(office.lat + 0.0009, office.lng));
  expect(screen.getByText("Near workplace boundary")).toBeTruthy();
  expect(screen.queryByText("Waiting for location")).toBeNull();
});
it("re-establishes status from one recovered GPS fix after a provider error without a fake departure", async () => {
  render(<App />);
  await act(async () => position());
  await act(async () =>
    failure?.({ message: "Unavailable", code: 2 } as GeolocationPositionError),
  );
  expect(screen.getByText("Waiting for location")).toBeTruthy();
  await act(async () => position(office.lat + 0.003));
  expect(screen.getByText("Off work")).toBeTruthy();
  expect(screen.queryByLabelText("Clocking out")).toBeNull();
});
it("reacquires status from one good fix after accuracy improves, without a false clock-out", async () => {
  render(<App />);
  await act(async () => position());
  await act(async () => position(office.lat, office.lng, 200));
  expect(screen.getByText("Low location accuracy")).toBeTruthy();
  await act(async () => position(office.lat + 0.003));
  expect(screen.getByText("Off work")).toBeTruthy();
  expect(screen.queryByLabelText("Clocking out")).toBeNull();
});
it("classifies an existing browser fix immediately after selecting a workplace", async () => {
  localStorage.clear();
  render(<App />);
  await act(async () => position());
  const input = screen.getByRole("combobox", {
    name: "Search your workplace address",
  });
  fireEvent.change(input, { target: { value: `${office.lat},${office.lng}` } });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  fireEvent.click(screen.getByRole("listbox").querySelector("button")!);
  expect(screen.getByText("Working")).toBeTruthy();
});
it.each([
  [0, "Working"],
  [0.003, "Off work"],
])(
  "initializes a Production fullscreen widget from one fix (%s)",
  async (offset, label) => {
    location.hash = "#/widget/production";
    render(<App />);
    await act(async () => position(office.lat + offset));
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByLabelText("Clocking out")).toBeNull();
  },
);
it("test locations override browser GPS and advanced parameters live only in Settings", async () => {
  vi.useFakeTimers();
  location.hash = "#/test";
  render(<App />);
  await act(async () => {
    position(0, 0);
  });
  await tick();
  expect(screen.getByLabelText("Distance").textContent).toContain("220");
  fireEvent.change(screen.getByRole("slider", { name: "Test distance" }), {
    target: { value: "40" },
  });
  await tick();
  expect(screen.getByText("Working")).toBeTruthy();
  await route("#/settings");
  expect(screen.getByRole("slider", { name: "Test accuracy" })).toBeTruthy();
  fireEvent.change(screen.getByRole("spinbutton", { name: "Test latitude" }), {
    target: { value: String(office.lat + 0.002) },
  });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Test longitude" }), {
    target: { value: String(office.lng) },
  });
  fireEvent.click(screen.getByRole("button", { name: "Set location" }));
  await route("#/test");
  await tick();
  expect(
    Number(
      screen.getByLabelText("Distance").textContent?.replace(/[^\d]/g, ""),
    ),
  ).toBeGreaterThan(200);
  expect(
    screen
      .getByRole("link", { name: "Open Test fullscreen widget" })
      .getAttribute("href"),
  ).toBe("#/widget/test");
  await route("#/production");
  expect(
    screen.queryByText("Test", { selector: ".location-label" }),
  ).toBeNull();
  expect(
    Number(
      screen.getByLabelText("Distance").textContent?.replace(/[^\d]/g, ""),
    ),
  ).toBeGreaterThan(10000000);
});
it("test entry/departure confirmation and unreliable accuracy remain correct after simplifying the UI", async () => {
  vi.useFakeTimers();
  location.hash = "#/test";
  render(<App />);
  fireEvent.change(screen.getByRole("slider", { name: "Test distance" }), {
    target: { value: "40" },
  });
  await tick();
  expect(screen.getByText("Working")).toBeTruthy();
  const stored = JSON.parse(localStorage.getItem("gw:settings")!);
  await act(async () => {
    localStorage.setItem(
      "gw:settings",
      JSON.stringify({ ...stored, accuracy: 200 }),
    );
    window.dispatchEvent(new StorageEvent("storage", { key: "gw:settings" }));
  });
  await tick();
  expect(screen.getByText("Low location accuracy")).toBeTruthy();
  expect(screen.queryByLabelText("Clocking out")).toBeNull();
  await act(async () => {
    localStorage.setItem(
      "gw:settings",
      JSON.stringify({ ...stored, accuracy: 15 }),
    );
    window.dispatchEvent(new StorageEvent("storage", { key: "gw:settings" }));
  });
  await tick();
  fireEvent.change(screen.getByRole("slider", { name: "Test distance" }), {
    target: { value: "180" },
  });
  await tick();
  expect(screen.getByLabelText("Clocking out")).toBeTruthy();
  await tick(3300);
  expect(screen.getByText("Off work")).toBeTruthy();
});
it("a fullscreen Test widget synchronizes cross-tab settings without replaying departure on reload", async () => {
  const code = workplaceFor(office).code;
  localStorage.setItem(
    "gw:settings",
    JSON.stringify({ distance: 40, accuracy: 15 }),
  );
  location.hash = "#/widget/test";
  vi.useFakeTimers();
  render(<App />);
  await tick();
  expect(screen.getByLabelText("Test widget")).toBeTruthy();
  expect(screen.queryByRole("navigation")).toBeNull();
  expect(screen.getByText("Working")).toBeTruthy();
  await act(async () => {
    localStorage.setItem(
      "gw:settings",
      JSON.stringify({ distance: 180, accuracy: 15 }),
    );
    window.dispatchEvent(new StorageEvent("storage", { key: "gw:settings" }));
  });
  await tick();
  expect(screen.getByLabelText("Clocking out")).toBeTruthy();
  await tick(3300);
  cleanup();
  localStorage.setItem(
    `gw:stable:${code}:simulation`,
    JSON.stringify("WORKING"),
  );
  render(<App />);
  await tick();
  expect(screen.queryByLabelText("Clocking out")).toBeNull();
  expect(screen.getByText("Off work")).toBeTruthy();
});
it("fullscreen Production widgets use GPS even when test state is saved", async () => {
  localStorage.setItem(
    "gw:settings",
    JSON.stringify({
      distance: 0,
      accuracy: 15,
      testLocation: office,
      provider: "simulation",
    }),
  );
  location.hash = "#/widget/production";
  render(<App />);
  await act(async () => {
    position(office.lat + 0.003);
  });
  await act(async () => {
    position(office.lat + 0.003);
  });
  expect(screen.getByLabelText("Production widget")).toBeTruthy();
  expect(screen.getByText("Off work")).toBeTruthy();
  expect(screen.queryByRole("navigation")).toBeNull();
  expect(screen.queryByRole("combobox")).toBeNull();
});
it("Settings preserve custom geofence radii after reload", async () => {
  location.hash = "#/settings";
  render(<App />);
  fireEvent.change(screen.getByRole("spinbutton", { name: "Entry radius" }), {
    target: { value: "30" },
  });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Exit radius" }), {
    target: { value: "70" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save geofence" }));
  cleanup();
  render(<App />);
  expect(
    (
      screen.getByRole("spinbutton", {
        name: "Entry radius",
      }) as HTMLInputElement
    ).value,
  ).toBe("30");
  expect(
    (
      screen.getByRole("spinbutton", {
        name: "Exit radius",
      }) as HTMLInputElement
    ).value,
  ).toBe("70");
});
it("the distance slider reflects a custom Test pin and resets it when moved", async () => {
  localStorage.setItem(
    "gw:settings",
    JSON.stringify({
      distance: 0,
      testLocation: {
        name: "Custom test pin",
        lat: office.lat + 0.002,
        lng: office.lng,
      },
      accuracy: 15,
    }),
  );
  location.hash = "#/test";
  vi.useFakeTimers();
  render(<App />);
  await tick();
  const slider = screen.getByRole("slider", {
    name: "Test distance",
  }) as HTMLInputElement;
  expect(Number(slider.value)).toBeGreaterThan(200);
  fireEvent.change(slider, { target: { value: "0" } });
  await tick();
  expect(screen.getByLabelText("Distance").textContent).toBe("0 m");
  expect(
    JSON.parse(localStorage.getItem("gw:settings")!).testLocation,
  ).toBeNull();
});
