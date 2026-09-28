export type Source = "browser" | "amap" | "simulation";
/** Normalized WGS84, meters, epoch milliseconds. */
export interface LocationSample {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  source: Source;
}
export interface LocationProvider {
  watch(
    onSample: (sample: LocationSample) => void,
    onError: (message: string) => void,
  ): () => void;
}
