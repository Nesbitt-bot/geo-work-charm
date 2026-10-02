import { expect, it } from "vitest";
import { pixelSize, pixelResolution, outlinePixels } from "./pixel";
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
it("preserves flat colors without inventing outlines", () => {
  const data = new Uint8ClampedArray(16 * 16 * 4);
  for (let i = 0; i < data.length; i += 4) data.set([80, 120, 160, 255], i);
  const result = outlinePixels(data, 16, 16, 4);
  for (let i = 0; i < result.length; i += 4)
    expect([...result.slice(i, i + 4)]).toEqual([80, 120, 160, 255]);
});
it("retains a thin dark contour that plain averaging would wash out", () => {
  const data = new Uint8ClampedArray(16 * 16 * 4);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const color = x === 7 ? 0 : 255;
      data.set([color, color, color, 255], (y * 16 + x) * 4);
    }
  const result = outlinePixels(data, 16, 16, 2);
  expect(result[0]).toBeLessThan((255 * 7) / 8);
  expect(result[4]).toBe(255);
  expect(result[3]).toBe(255);
});
it("preserves transparency without introducing a dark matte", () => {
  const data = new Uint8ClampedArray(8 * 8 * 4);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++)
      if (x < 2) data.set([255, 80, 40, 255], (y * 8 + x) * 4);
  const result = outlinePixels(data, 8, 8, 2);
  expect([...result.slice(0, 4)]).toEqual([255, 80, 40, 128]);
  expect([...result.slice(4, 8)]).toEqual([0, 0, 0, 0]);
});
