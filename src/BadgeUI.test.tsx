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
import { Browser } from "leaflet";
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  location.hash = "#/production";
  Object.defineProperty(Browser, "svg", { value: true, configurable: true });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
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
it("animates inline SVG lights through both directions and cleans up the overlay", () => {
  vi.useFakeTimers();
  try {
    render(<App />);
    const badge = screen.getByRole("region", { name: "Work badge" });
    fireEvent.doubleClick(badge);
    const scene = screen.getByRole("img", {
      name: "Office lights turning off",
    });
    expect(scene.querySelectorAll("svg .office-floor")).toHaveLength(7);
    const ids = Array.from(document.querySelectorAll(".office-scene [id]")).map(
      (el) => el.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
    act(() => vi.advanceTimersByTime(3200));
    expect(
      screen.queryByRole("img", { name: "Office lights turning off" }),
    ).toBeNull();
    expect(
      screen
        .getByRole("img", { name: "Off-work display" })
        .querySelector("svg"),
    ).toBeTruthy();
    fireEvent.doubleClick(badge);
    expect(
      screen
        .getByRole("img", { name: "Office lights turning on" })
        .querySelector("svg"),
    ).toBeTruthy();
    act(() => vi.advanceTimersByTime(3200));
    expect(
      screen.queryByRole("img", { name: "Office lights turning on" }),
    ).toBeNull();
    expect(screen.getByRole("img", { name: "Badge portrait" })).toBeTruthy();
  } finally {
    vi.useRealTimers();
  }
});
it("keeps the light fade visible with reduced motion and removes it after the shorter duration", () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true })),
  );
  vi.useFakeTimers();
  try {
    render(<App />);
    fireEvent.doubleClick(screen.getByRole("region", { name: "Work badge" }));
    expect(
      screen.getByRole("img", { name: "Office lights turning off" }),
    ).toBeTruthy();
    act(() => vi.advanceTimersByTime(899));
    expect(
      screen.getByRole("img", { name: "Office lights turning off" }),
    ).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(
      screen.queryByRole("img", { name: "Office lights turning off" }),
    ).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});
it("double-clicks without GPS or a workplace, replays off-work animation and supports keyboard switching", () => {
  render(<App />);
  const badge = screen.getByRole("region", { name: "Work badge" });
  fireEvent.doubleClick(badge);
  expect(screen.getByRole("status").textContent).toBe("Off work");
  expect(screen.getByLabelText("Clocking out")).toBeTruthy();
  expect(
    screen.getByRole("img", { name: "Office lights turning off" }),
  ).toBeTruthy();
  expect(screen.queryByRole("img", { name: "Badge portrait" })).toBeNull();
  expect(
    screen
      .getByRole("img", { name: "Off-work display" })
      .parentElement?.classList.contains("offwork-scene"),
  ).toBe(true);
  const firstImage = screen.getByRole("img", { name: "Off-work display" });
  fireEvent.doubleClick(badge);
  expect(screen.getByRole("status").textContent).toBe("Working");
  expect(
    screen.getByRole("img", { name: "Office lights turning on" }),
  ).toBeTruthy();
  expect(screen.queryByLabelText("Clocking out")).toBeNull();
  fireEvent.keyDown(badge, { key: "Enter" });
  expect(screen.getByLabelText("Clocking out")).toBeTruthy();
  expect(screen.getByRole("img", { name: "Off-work display" })).not.toBe(
    firstImage,
  );
});
it("disables and persists the shortcut, restores automatic status and ignores the menu", () => {
  render(<App />);
  const badge = screen.getByRole("region", { name: "Work badge" });
  fireEvent.doubleClick(screen.getByRole("button", { name: "Open settings" }));
  expect(screen.getByRole("status").textContent).toBe("Demo badge");
  fireEvent.doubleClick(badge);
  open();
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Double-tap to switch status" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Return to badge" }));
  expect(screen.getByRole("status").textContent).toBe("Demo badge");
  fireEvent.doubleClick(badge);
  expect(screen.getByRole("status").textContent).toBe("Demo badge");
  cleanup();
  render(<App />);
  fireEvent.doubleClick(screen.getByRole("region", { name: "Work badge" }));
  expect(screen.getByRole("status").textContent).toBe("Demo badge");
  open();
  expect(
    (
      screen.getByRole("checkbox", {
        name: "Double-tap to switch status",
      }) as HTMLInputElement
    ).checked,
  ).toBe(false);
});
it("handles mobile double-taps once and excludes dragging, cancellation and long presses", () => {
  class TestPointerEvent extends MouseEvent {
    pointerType: string;
    pointerId: number;
    isPrimary: boolean;
    constructor(
      type: string,
      options: MouseEventInit & {
        pointerType?: string;
        pointerId?: number;
        isPrimary?: boolean;
      },
    ) {
      super(type, options);
      this.pointerType = options.pointerType ?? "touch";
      this.pointerId = options.pointerId ?? 1;
      this.isPrimary = options.isPrimary ?? true;
    }
  }
  vi.stubGlobal("PointerEvent", TestPointerEvent);
  vi.useFakeTimers();
  try {
    render(<App />);
    const badge = screen.getByRole("region", { name: "Work badge" });
    const point = { clientX: 150, clientY: 300 };
    const tap = () => {
      fireEvent.pointerDown(badge, point);
      fireEvent.pointerUp(badge, point);
    };
    tap();
    act(() => vi.advanceTimersByTime(100));
    tap();
    fireEvent.doubleClick(badge);
    expect(screen.getByRole("status").textContent).toBe("Off work");
    expect(screen.getByLabelText("Clocking out")).toBeTruthy();
    act(() => vi.advanceTimersByTime(600));
    fireEvent.pointerDown(badge, point);
    fireEvent.pointerMove(badge, { clientX: 200, clientY: 300 });
    fireEvent.pointerUp(badge, point);
    tap();
    expect(screen.getByRole("status").textContent).toBe("Off work");
    fireEvent.pointerDown(badge, point);
    fireEvent.pointerCancel(badge, point);
    tap();
    expect(screen.getByRole("status").textContent).toBe("Off work");
    act(() => vi.advanceTimersByTime(600));
    fireEvent.pointerDown(badge, point);
    act(() => vi.advanceTimersByTime(500));
    fireEvent.pointerUp(badge, point);
    tap();
    expect(screen.getByRole("status").textContent).toBe("Off work");
  } finally {
    vi.useRealTimers();
  }
});
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
    "Settings",
    "Debugging",
  ]);
  expect(
    screen.getAllByRole("heading", { level: 2 }).map((el) => el.textContent),
  ).toEqual(["Info", "Company location", "Additional"]);
  expect(
    screen.queryByRole("combobox", { name: "Custom location search" }),
  ).toBeNull();
  fireEvent.change(screen.getByRole("combobox", { name: "Location source" }), {
    target: { value: "custom" },
  });
  expect(
    screen.getByRole("combobox", { name: "Custom location search" }),
  ).toBeTruthy();
  expect(screen.getByRole("combobox", { name: "Company address" }).id).not.toBe(
    screen.getByRole("combobox", { name: "Custom location search" }).id,
  );
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
it("restores the location source on reload and shows the map before logs in Debugging", () => {
  render(<App />);
  open();
  fireEvent.change(screen.getByRole("combobox", { name: "Location source" }), {
    target: { value: "custom" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Return to badge" }));
  expect(location.hash).toBe("#/badge");
  cleanup();
  render(<App />);
  open();
  expect(
    (
      screen.getByRole("combobox", {
        name: "Location source",
      }) as HTMLSelectElement
    ).value,
  ).toBe("custom");
  fireEvent.click(screen.getByRole("tab", { name: "Debugging" }));
  expect(screen.queryByRole("heading", { name: "Info" })).toBeNull();
  expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
  expect(
    screen
      .getByRole("region", { name: "Location overview" })
      .compareDocumentPosition(
        screen.getByRole("region", { name: "Debugging logs" }),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});
it("shows maps and logs in Debugging and enables the persisted gravity-reflection switch", async () => {
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
