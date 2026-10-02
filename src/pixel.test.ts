import { expect, it } from "vitest";
import { pixelSize, pixelResolution } from "./pixel";
it("uses kernel 30 for old settings and bounds malformed slider values", () => {
  expect(pixelSize(undefined)).toBe(30);
  expect(pixelSize(NaN)).toBe(30);
  expect(pixelSize("10")).toBe(30);
  expect(pixelSize(0)).toBe(1);
  expect(pixelSize(300)).toBe(64);
  expect(pixelSize(4.7)).toBe(5);
  expect(pixelResolution(30)).toBe(18);
  expect(pixelResolution(1)).toBe(512);
  expect(pixelResolution(64)).toBe(8);
});
