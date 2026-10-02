// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PixelImage, PixelPortrait } from "./PixelPortrait";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("center-crops into a 512-square sample before applying the default 30-pixel kernel", async () => {
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
    512,
    512,
  );
  expect(drawImage).toHaveBeenLastCalledWith(
    expect.any(HTMLCanvasElement),
    0,
    0,
    512,
    512,
    0,
    0,
    18,
    18,
  );
  expect(
    screen.getByRole("img", { name: "Badge portrait" }).getAttribute("src"),
  ).toBe("data:image/png;base64,pixel-preview");
});
it("keeps a rectangular SVG/logo contained in the 512 sample and resizes without decoding again", async () => {
  const decode = vi.fn().mockResolvedValue(undefined);
  class LogoImage {
    src = "";
    naturalWidth = 200;
    naturalHeight = 100;
    decode = decode;
  }
  vi.stubGlobal("Image", LogoImage);
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
    "data:image/png;base64,logo",
  );
  let view: ReturnType<typeof render>;
  await act(async () => {
    view = render(
      <PixelImage src="blob:svg-logo" alt="Logo" fit="contain" kernel={30} />,
    );
  });
  expect(drawImage).toHaveBeenCalledWith(
    expect.any(LogoImage),
    0,
    128,
    512,
    256,
  );
  view!.rerender(
    <PixelImage src="blob:svg-logo" alt="Logo" fit="contain" kernel={8} />,
  );
  expect(drawImage).toHaveBeenLastCalledWith(
    expect.any(HTMLCanvasElement),
    0,
    0,
    512,
    512,
    0,
    0,
    64,
    64,
  );
  expect(decode).toHaveBeenCalledTimes(1);
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
