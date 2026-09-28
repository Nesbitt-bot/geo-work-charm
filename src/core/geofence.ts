import distance from "@turf/distance";
import type { LocationSample } from "../location/types";
export type Status = "UNKNOWN" | "WORKING" | "OFF_WORK";
export interface Workplace {
  code: string;
  name: string;
  lat: number;
  lng: number;
  enter: number;
  exit: number;
}
export interface State {
  stable: Status;
  display: Status;
  raw: Status;
  candidate: Status;
  count: number;
  lastTransition: string | null;
  departure: number;
}
export const initialState = (stable: Status = "UNKNOWN"): State => ({
  stable,
  display: "UNKNOWN",
  raw: "UNKNOWN",
  candidate: "UNKNOWN",
  count: 0,
  lastTransition: null,
  departure: 0,
});
export const validCoordinate = (lat: number, lng: number) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lng) <= 180;
export function metersFrom(s: LocationSample, w: Workplace) {
  return validCoordinate(s.latitude, s.longitude) &&
    validCoordinate(w.lat, w.lng)
    ? distance([s.longitude, s.latitude], [w.lng, w.lat], { units: "meters" })
    : NaN;
}
// Future seam: Turf booleanPointInPolygon classification with the same reliability/reducer contract.
export function evaluate(
  d: number,
  a: number,
  stable: Status,
  enter = 80,
  exit = 120,
): Status {
  if (
    ![d, a, enter, exit].every(Number.isFinite) ||
    d < 0 ||
    a < 0 ||
    a > 150 ||
    enter < 0 ||
    exit <= enter
  )
    return "UNKNOWN";
  return d <= enter ? "WORKING" : d >= exit ? "OFF_WORK" : stable;
}
export function reduceSample(
  s: State,
  d: number,
  a: number,
  enter = 80,
  exit = 120,
): State {
  const raw = evaluate(d, a, s.stable, enter, exit);
  if (raw === "UNKNOWN")
    return { ...s, raw, display: "UNKNOWN", candidate: "UNKNOWN", count: 0 };
  if (raw === s.stable)
    return { ...s, raw, display: s.stable, candidate: "UNKNOWN", count: 0 };
  const count = s.candidate === raw ? s.count + 1 : 1;
  if (count < 2) return { ...s, raw, display: s.stable, candidate: raw, count };
  return {
    ...s,
    stable: raw,
    display: raw,
    raw,
    candidate: "UNKNOWN",
    count: 0,
    lastTransition: `${s.stable} → ${raw}`,
    departure:
      s.departure + (s.stable === "WORKING" && raw === "OFF_WORK" ? 1 : 0),
  };
}
