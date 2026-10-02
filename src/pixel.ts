export const SAMPLE_SIZE = 512;
export const DEFAULT_PIXEL_SIZE = 30;
export type PixelMethod = "mosaic" | "outline";

// Sobel gradients select dark contour samples before averaging output cells.
export function outlinePixels(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  resolution: number,
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(resolution * resolution * 4);
  const luminance = new Float32Array(width * height);
  for (let i = 0; i < luminance.length; i++) {
    const at = i * 4,
      alpha = source[at + 3] / 255;
    luminance[i] =
      (source[at] * 0.2126 +
        source[at + 1] * 0.7152 +
        source[at + 2] * 0.0722) *
        alpha +
      255 * (1 - alpha);
  }
  const value = (x: number, y: number) =>
    luminance[
      Math.min(height - 1, Math.max(0, y)) * width +
        Math.min(width - 1, Math.max(0, x))
    ];
  for (let row = 0; row < resolution; row++)
    for (let col = 0; col < resolution; col++) {
      const left = Math.floor((col * width) / resolution),
        right = Math.max(
          left + 1,
          Math.floor(((col + 1) * width) / resolution),
        );
      const top = Math.floor((row * height) / resolution),
        bottom = Math.max(
          top + 1,
          Math.floor(((row + 1) * height) / resolution),
        );
      let r = 0,
        g = 0,
        b = 0,
        alpha = 0,
        inkR = 0,
        inkG = 0,
        inkB = 0,
        weight = 0,
        edges = 0;
      for (let y = top; y < bottom; y++)
        for (let x = left; x < right; x++) {
          const at = (y * width + x) * 4,
            a = source[at + 3] / 255;
          r += source[at] * a;
          g += source[at + 1] * a;
          b += source[at + 2] * a;
          alpha += a;
          if (a < 0.5) continue;
          const nw = value(x - 1, y - 1),
            n = value(x, y - 1),
            ne = value(x + 1, y - 1);
          const w = value(x - 1, y),
            e = value(x + 1, y);
          const sw = value(x - 1, y + 1),
            s = value(x, y + 1),
            se = value(x + 1, y + 1);
          const gradient =
            Math.hypot(
              ne + 2 * e + se - nw - 2 * w - sw,
              sw + 2 * s + se - nw - 2 * n - ne,
            ) / 4;
          const mean = (nw + n + ne + w + e + sw + s + se) / 8;
          if (gradient > 40 && value(x, y) < mean - 8) {
            const strength = gradient * a;
            inkR += source[at] * strength;
            inkG += source[at + 1] * strength;
            inkB += source[at + 2] * strength;
            weight += strength;
            edges++;
          }
        }
      const count = (right - left) * (bottom - top),
        at = (row * resolution + col) * 4;
      const mix = weight ? Math.min(0.35, 0.08 + (edges / count) * 1.5) : 0;
      if (alpha) {
        output[at] =
          (r / alpha) * (1 - mix) + (weight ? inkR / weight : 0) * mix;
        output[at + 1] =
          (g / alpha) * (1 - mix) + (weight ? inkG / weight : 0) * mix;
        output[at + 2] =
          (b / alpha) * (1 - mix) + (weight ? inkB / weight : 0) * mix;
      }
      output[at + 3] = (alpha / count) * 255;
    }
  return output;
}
export function pixelSize(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(64, Math.max(1, Math.round(value)))
    : DEFAULT_PIXEL_SIZE;
}
export function pixelResolution(kernel: number): number {
  return Math.ceil(SAMPLE_SIZE / pixelSize(kernel));
}
