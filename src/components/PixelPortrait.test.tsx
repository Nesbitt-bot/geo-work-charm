// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PixelPortrait } from "./PixelPortrait";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("center-crops a high-resolution upload into a 48-pixel preview", async () => {
  class DecodedImage {
    src = "";
    naturalWidth = 1200;
    naturalHeight = 800;
    decode() {
      return Promise.resolve();
    }
  }
  vi.stubGlobal("Image", DecodedImage);
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
    "data:image/png;base64,pixel-preview",
  );
  await act(async () => render(<PixelPortrait src="blob:original-upload" />));
  expect(drawImage).toHaveBeenCalledWith(
    expect.any(DecodedImage),
    200,
    0,
    800,
    800,
    0,
    0,
    48,
    48,
  );
  expect(
    screen.getByRole("img", { name: "Badge portrait" }).getAttribute("src"),
  ).toBe("data:image/png;base64,pixel-preview");
});
it("ignores a stale decode after replacing the uploaded photo", async () => {
  const finish: (() => void)[] = [];
  class SlowImage {
    src = "";
    naturalWidth = 100;
    naturalHeight = 100;
    decode() {
      return new Promise<void>((resolve) => finish.push(resolve));
    }
  }
  vi.stubGlobal("Image", SlowImage);
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
    "data:image/png;base64,new-preview",
  );
  const { rerender } = render(<PixelPortrait src="blob:first" />);
  await act(async () => {});
  await act(async () => rerender(<PixelPortrait src="blob:second" />));
  await act(async () => finish[0]());
  expect(drawImage).not.toHaveBeenCalled();
  expect(
    screen.getByRole("img", { name: "Badge portrait" }).getAttribute("src"),
  ).toBe("blob:second");
  await act(async () => finish[1]());
  expect(
    screen.getByRole("img", { name: "Badge portrait" }).getAttribute("src"),
  ).toBe("data:image/png;base64,new-preview");
});
it("falls back to the original image if decoding fails", async () => {
  class InvalidImage {
    src = "";
    decode() {
      return Promise.reject(Error("invalid"));
    }
  }
  vi.stubGlobal("Image", InvalidImage);
  await act(async () => render(<PixelPortrait src="blob:unsupported" />));
  expect(
    screen.getByRole("img", { name: "Badge portrait" }).getAttribute("src"),
  ).toBe("blob:unsupported");
});
