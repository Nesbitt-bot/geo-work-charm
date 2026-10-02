export const SAMPLE_SIZE = 512;
export const DEFAULT_PIXEL_SIZE = 30;
export function pixelSize(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(64, Math.max(1, Math.round(value)))
    : DEFAULT_PIXEL_SIZE;
}
export function pixelResolution(kernel: number): number {
  return Math.ceil(SAMPLE_SIZE / pixelSize(kernel));
}
