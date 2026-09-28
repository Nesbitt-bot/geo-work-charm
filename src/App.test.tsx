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
const users = [
  {
    code: "DEMO001",
    name: "Beijing demo",
    lat: 39.984,
    lng: 116.307,
    enter: 80,
    exit: 120,
  },
];
beforeEach(() => {
  localStorage.clear();
  location.hash = "#/debug";
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(users) }),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("dashboard simulation, accuracy freeze, full departure and widget route smoke", async () => {
  render(<App />);
  await screen.findByText("Test the threshold.");
  expect(screen.getAllByRole("button", { name: /ANON-/ })).toHaveLength(30);
  fireEvent.click(screen.getByRole("button", { name: "ANON-01" }));
  expect(screen.getByText("ANON-01 · simulated")).toBeTruthy();
  vi.useFakeTimers();
  fireEvent.click(
    screen.getByRole("button", { name: "Use simulated location" }),
  );
  await act(async () => {
    vi.advanceTimersByTime(2300);
  });
  fireEvent.change(screen.getByRole("slider", { name: "Mock distance" }), {
    target: { value: "40" },
  });
  await act(async () => {
    vi.advanceTimersByTime(2300);
  });
  expect(screen.getByText("● WORKING")).toBeTruthy();
  fireEvent.change(screen.getByRole("slider", { name: "Mock accuracy" }), {
    target: { value: "200" },
  });
  await act(async () => {
    vi.advanceTimersByTime(2300);
  });
  expect(screen.getByText("● UNKNOWN")).toBeTruthy();
  expect(screen.queryByLabelText("Clocking out")).toBeNull();
  fireEvent.change(screen.getByRole("slider", { name: "Mock accuracy" }), {
    target: { value: "15" },
  });
  await act(async () => {
    vi.advanceTimersByTime(2300);
  });
  fireEvent.change(screen.getByRole("slider", { name: "Mock distance" }), {
    target: { value: "180" },
  });
  await act(async () => {
    vi.advanceTimersByTime(2300);
  });
  expect(screen.getByLabelText("Clocking out")).toBeTruthy();
  await act(async () => {
    vi.advanceTimersByTime(3300);
  });
  expect(screen.queryByLabelText("Clocking out")).toBeNull();
  await act(async () => {
    location.hash = "#/widget?code=DEMO001";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByText("Make room for life.")).toBeTruthy();
  cleanup();
  render(<App />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  await act(async () => {
    vi.advanceTimersByTime(2300);
  });
  expect(screen.queryByLabelText("Clocking out")).toBeNull();
});

it("storage events drive an already-open widget and restored working state does not fake a departure", async () => {
  location.hash = "#/widget?code=DEMO001";
  localStorage.setItem(
    "gw:settings",
    JSON.stringify({
      code: "DEMO001",
      provider: "simulation",
      distance: 200,
      accuracy: 15,
    }),
  );
  localStorage.setItem(
    "gw:stable:DEMO001:simulation",
    JSON.stringify("WORKING"),
  );
  vi.useFakeTimers();
  render(<App />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  await act(async () => {
    vi.advanceTimersByTime(2400);
  });
  expect(screen.queryByLabelText("Clocking out")).toBeNull();
  expect(screen.getByText("Make room for life.")).toBeTruthy();
  await act(async () => {
    localStorage.setItem(
      "gw:settings",
      JSON.stringify({
        code: "DEMO001",
        provider: "simulation",
        distance: 30,
        accuracy: 15,
      }),
    );
    window.dispatchEvent(new StorageEvent("storage", { key: "gw:settings" }));
  });
  await act(async () => {
    vi.advanceTimersByTime(2400);
  });
  expect(screen.getByText("In your own rhythm.")).toBeTruthy();
});
