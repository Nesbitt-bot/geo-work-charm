import destination from "@turf/destination";
import type { Workplace } from "../core/geofence";
export interface Neighbor {
  id: string;
  coordinate: [number, number];
  workplace: string;
  status: string;
  arrival: string;
  leaving: string;
}
const time = (m: number) =>
  `${Math.floor(m / 60)
    .toString()
    .padStart(2, "0")}:${(m % 60).toString().padStart(2, "0")}`;
export function nearby(anchor: [number, number], now = new Date()): Neighbor[] {
  let seed = 2166136261;
  for (const c of `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}:${anchor.map((n) => n.toFixed(3)).join(",")}`)
    seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
  const random = () => {
    seed += 0x6d2b79f5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: 30 }, (_, i) => {
    const coordinate = destination(
        anchor,
        Math.sqrt(random()) * 5,
        random() * 360,
      ).geometry.coordinates as [number, number],
      arrival = 510 + Math.floor(random() * 121),
      leaving = 1020 + Math.floor(random() * 211),
      minute = now.getHours() * 60 + now.getMinutes();
    return {
      id: `ANON-${String(i + 1).padStart(2, "0")}`,
      coordinate,
      workplace: `Fictional studio ${(i % 6) + 1}`,
      status: minute >= arrival && minute < leaving ? "WORKING" : "OFF_WORK",
      arrival: time(arrival),
      leaving: time(leaving),
    };
  });
}
export function simulatedSample(
  w: Workplace,
  meters: number,
  accuracy: number,
) {
  const [longitude, latitude] = destination([w.lng, w.lat], meters / 1000, 65)
    .geometry.coordinates;
  return {
    longitude,
    latitude,
    accuracy,
    timestamp: Date.now(),
    source: "simulation" as const,
  };
}
