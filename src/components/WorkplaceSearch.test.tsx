// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WorkplaceSearch } from "./WorkplaceSearch";
import { rememberPlace, savedPlaces } from "../location/geocode";
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const response = () =>
  new Response(
    JSON.stringify({
      features: [
        {
          geometry: { coordinates: [112.965934, 28.2054614] },
          properties: { name: "万达·总部国际·C区" },
        },
      ],
    }),
  );
it("defaults online with no presets and debounces address suggestions without pressing Search", async () => {
  vi.useFakeTimers();
  vi.mocked(fetch).mockImplementation(async () => response());
  const choose = vi.fn();
  render(<WorkplaceSearch sample={null} onChoose={choose} />);
  expect(
    (
      screen.getByRole("checkbox", {
        name: "Online address search",
      }) as HTMLInputElement
    ).checked,
  ).toBe(true);
  expect(screen.queryByRole("option")).toBeNull();
  const input = screen.getByRole("combobox");
  fireEvent.change(input, { target: { value: "长沙万达总部国际 C区" } });
  await act(async () => {
    vi.advanceTimersByTime(599);
  });
  expect(fetch).not.toHaveBeenCalled();
  await act(async () => {
    vi.advanceTimersByTime(1);
  });
  expect(screen.getByRole("option").textContent).toContain("万达·总部国际·C区");
  expect(savedPlaces()).toEqual([]);
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(choose).toHaveBeenCalledWith(
    expect.objectContaining({
      lat: 28.2054614,
      lng: 112.965934,
      searchText: "长沙万达总部国际 C区",
    }),
  );
});
it("shows selected history on an empty query and permits offline coordinate entry", () => {
  rememberPlace({ name: "My office", lat: 1, lng: 2 });
  const choose = vi.fn();
  render(<WorkplaceSearch sample={null} onChoose={choose} />);
  fireEvent.focus(screen.getByRole("combobox"));
  expect(
    screen.getByRole("listbox", { name: "Recent addresses" }),
  ).toBeTruthy();
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Online address search" }),
  );
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "39.984,116.307" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  fireEvent.click(screen.getByRole("button", { name: /39.98400/ }));
  expect(choose).toHaveBeenCalledWith(
    expect.objectContaining({ lat: 39.984, lng: 116.307 }),
  );
  expect(fetch).not.toHaveBeenCalled();
});
it("waits for Chinese IME composition to finish before requesting suggestions", async () => {
  vi.useFakeTimers();
  vi.mocked(fetch).mockImplementation(async () => response());
  render(<WorkplaceSearch sample={null} onChoose={vi.fn()} />);
  const input = screen.getByRole("combobox");
  fireEvent.compositionStart(input);
  fireEvent.change(input, { target: { value: "长沙" } });
  await act(async () => {
    vi.advanceTimersByTime(1000);
  });
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.compositionEnd(input);
  await act(async () => {
    vi.advanceTimersByTime(600);
  });
  expect(fetch).toHaveBeenCalledOnce();
});
it("ignores stale searches and preserves history on provider failure", async () => {
  rememberPlace({ name: "Paris office", lat: 48.85, lng: 2.35 });
  let resolve!: (response: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  render(<WorkplaceSearch sample={null} onChoose={vi.fn()} />);
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "Old address" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "Paris" },
  });
  await act(async () => resolve(response()));
  expect(screen.queryByRole("option", { name: /万达/ })).toBeNull();
  vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Network failure"));
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  await screen.findByText(/Address search is unavailable/);
  expect(screen.getByRole("option").textContent).toContain("Paris office");
});
