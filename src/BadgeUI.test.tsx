// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App";
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  location.hash = "#/production";
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { watchPosition: vi.fn(() => 1), clearWatch: vi.fn() },
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (navigator as unknown as { geolocation?: unknown }).geolocation;
});
const open = () =>
  fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
it("starts with only the badge front and supplied defaults; opening the menu flips to sectioned settings", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "Trance-0" })).toBeTruthy();
  expect(screen.getByText("Vibe coding engineer")).toBeTruthy();
  expect(
    screen.getByRole("img", { name: "Badge portrait" }).getAttribute("src"),
  ).toContain("default-avatar");
  expect(screen.queryByRole("tablist")).toBeNull();
  expect(screen.queryByRole("combobox")).toBeNull();
  open();
  expect(
    document.querySelector(".badge-card")?.classList.contains("is-flipped"),
  ).toBe(true);
  expect(screen.getAllByRole("tab").map((el) => el.textContent)).toEqual([
    "Production",
    "Test",
    "Debugging",
  ]);
  expect(
    screen.getAllByRole("heading", { level: 2 }).map((el) => el.textContent),
  ).toEqual(["Info", "Company location", "Additional"]);
  expect(
    screen.queryByRole("combobox", { name: "Test location search" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "Test" }));
  expect(
    screen.getByRole("combobox", { name: "Test location search" }),
  ).toBeTruthy();
  const inputs = screen.getAllByRole("combobox");
  expect(inputs[0].id).not.toBe(inputs[1].id);
});
it("saves profile, optional department, theme and palette and restores them on reload", () => {
  render(<App />);
  open();
  fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
    target: { value: "Avery" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "Department" }), {
    target: { value: "Engineering" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Dark" }));
  fireEvent.change(screen.getByLabelText("accent color"), {
    target: { value: "#aa77cc" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Return to badge" }));
  expect(screen.getByRole("heading", { name: "Avery" })).toBeTruthy();
  expect(screen.getByText("Engineering")).toBeTruthy();
  cleanup();
  render(<App />);
  expect(
    document.querySelector(".badge-app")?.classList.contains("theme-dark"),
  ).toBe(true);
  expect(
    (
      document.querySelector(".badge-app") as HTMLElement
    ).style.getPropertyValue("--accent"),
  ).toBe("#aa77cc");
  expect(screen.getByRole("heading", { name: "Avery" })).toBeTruthy();
});
it("restores the chosen mode on reload and keeps Debugging free of settings", () => {
  render(<App />);
  open();
  fireEvent.click(screen.getByRole("tab", { name: "Test" }));
  fireEvent.click(screen.getByRole("button", { name: "Return to badge" }));
  expect(location.hash).toBe("#/test");
  cleanup();
  render(<App />);
  open();
  expect(
    screen.getByRole("tab", { name: "Test" }).getAttribute("aria-selected"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("tab", { name: "Debugging" }));
  expect(screen.queryByRole("heading", { name: "Info" })).toBeNull();
  expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
});
it("shows logging only in Debugging and enables the persisted gravity-reflection switch", async () => {
  render(<App />);
  open();
  fireEvent.click(screen.getByRole("checkbox", { name: "Gravity reflection" }));
  fireEvent.click(screen.getByRole("tab", { name: "Debugging" }));
  expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
  expect(screen.queryByRole("combobox")).toBeNull();
  expect(screen.getByRole("region", { name: "Debugging logs" })).toBeTruthy();
  expect(screen.getByText(/Gravity reflection enabled/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Return to badge" }));
  expect(
    document.querySelector(".badge-front")?.classList.contains("has-foil"),
  ).toBe(true);
  expect(JSON.parse(localStorage.getItem("gw:settings")!).foil).toBe(true);
  await act(async () => {
    const event = new Event("deviceorientation");
    Object.assign(event, { gamma: 18, beta: 55 });
    window.dispatchEvent(event);
    await new Promise((resolve) => setTimeout(resolve, 35));
  });
  expect(
    (
      document.querySelector(".badge-front") as HTMLElement
    ).style.getPropertyValue("--shine-x"),
  ).not.toBe("");
  const before = (
    document.querySelector(".badge-front") as HTMLElement
  ).style.getPropertyValue("--shine-y");
  await act(async () => {
    const event = new Event("deviceorientation");
    Object.assign(event, { gamma: 25, beta: 70 });
    window.dispatchEvent(event);
    await new Promise((resolve) => setTimeout(resolve, 35));
  });
  expect(
    (
      document.querySelector(".badge-front") as HTMLElement
    ).style.getPropertyValue("--shine-y"),
  ).not.toBe(before);
});
it("requests motion permission from the user gesture on supported phones and degrades to pointer reflection", async () => {
  const requestPermission = vi.fn().mockResolvedValue("denied");
  vi.stubGlobal("DeviceOrientationEvent", { requestPermission });
  render(<App />);
  open();
  fireEvent.click(screen.getByRole("checkbox", { name: "Gravity reflection" }));
  await screen.findByText(/Motion access declined/);
  expect(requestPermission).toHaveBeenCalledOnce();
  expect(
    (
      screen.getByRole("checkbox", {
        name: "Gravity reflection",
      }) as HTMLInputElement
    ).checked,
  ).toBe(true);
});
