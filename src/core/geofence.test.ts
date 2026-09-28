import { describe, it, expect } from "vitest";
import {
  evaluate,
  initialState,
  reduceSample,
  metersFrom,
  validCoordinate,
} from "./geofence";
import { nearby, simulatedSample } from "../geo/nearby";
import { gcj02ToWgs84, wgs84ToGcj02 } from "../geo/coordinates";
const twice = (d: number, s = initialState(), accuracy = 15) =>
  reduceSample(reduceSample(s, d, accuracy), d, accuracy);
describe("geofence contract", () => {
  it("initial outside confirms OFF_WORK without a departure", () => {
    expect(twice(200)).toMatchObject({ stable: "OFF_WORK", departure: 0 });
  });
  it("initial inside needs two samples", () => {
    expect(reduceSample(initialState(), 30, 10).stable).toBe("UNKNOWN");
    expect(twice(30).stable).toBe("WORKING");
  });
  it("80–120 hysteresis retains working", () => {
    expect(twice(100, twice(40)).stable).toBe("WORKING");
  });
  it("80–120 hysteresis retains off work", () => {
    expect(twice(100, twice(200)).stable).toBe("OFF_WORK");
  });
  it("confirmed departure fires exactly once", () => {
    const s = twice(130, twice(40));
    expect(s.departure).toBe(1);
    expect(twice(200, s).departure).toBe(1);
  });
  it("poor accuracy freezes stable but displays UNKNOWN", () => {
    expect(twice(200, twice(30), 151)).toMatchObject({
      stable: "WORKING",
      display: "UNKNOWN",
      departure: 0,
    });
  });
  it("initial hysteresis band stays unknown", () => {
    expect(twice(100).stable).toBe("UNKNOWN");
  });
  it("inclusive 80/120 and 150 accuracy boundaries", () => {
    expect(evaluate(80, 150, "UNKNOWN")).toBe("WORKING");
    expect(evaluate(120, 150, "UNKNOWN")).toBe("OFF_WORK");
  });
  it.each([
    [NaN, 1],
    [Infinity, 1],
    [-1, 1],
    [10, -1],
    [10, NaN],
    [10, Infinity],
  ])("rejects invalid values %s %s", (d, a) =>
    expect(evaluate(d, a, "WORKING")).toBe("UNKNOWN"),
  );
  it("invalid fence config is unknown", () =>
    expect(evaluate(1, 1, "WORKING", 120, 80)).toBe("UNKNOWN"));
  it("unreliable sample resets candidate streak", () => {
    let s = twice(30);
    s = reduceSample(s, 200, 10);
    s = reduceSample(s, 200, 160);
    s = reduceSample(s, 200, 10);
    expect(s.stable).toBe("WORKING");
    expect(reduceSample(s, 200, 10).stable).toBe("OFF_WORK");
  });
  it("opposite valid sample resets streak", () => {
    let s = twice(30);
    s = reduceSample(s, 200, 10);
    s = reduceSample(s, 100, 10);
    expect(reduceSample(s, 200, 10).stable).toBe("WORKING");
  });
  it("whole demo only departs once", () => {
    let s = initialState();
    for (const d of [220, 100, 50, 45, 100, 160]) s = twice(d, s);
    expect(s).toMatchObject({ stable: "OFF_WORK", departure: 1 });
  });
  it("coordinates and Turf distance validate", () => {
    expect(validCoordinate(91, 0)).toBe(false);
    expect(validCoordinate(0, 181)).toBe(false);
    const w = {
      code: "x",
      name: "x",
      lat: 39.984,
      lng: 116.307,
      enter: 80,
      exit: 120,
    };
    expect(metersFrom(simulatedSample(w, 123, 10), w)).toBeCloseTo(123, 5);
    expect(
      metersFrom({ ...simulatedSample(w, 123, 10), latitude: NaN }, w),
    ).toBeNaN();
  });
});
describe("coordinate and seeded data adapters", () => {
  it("round trips China approximately", () => {
    const c: [number, number] = [116.307, 39.984],
      back = gcj02ToWgs84(wgs84ToGcj02(c));
    expect(back[0]).toBeCloseTo(c[0], 6);
    expect(back[1]).toBeCloseTo(c[1], 6);
  });
  it("leaves overseas unchanged", () =>
    expect(wgs84ToGcj02([-87.6, 41.8])).toEqual([-87.6, 41.8]));
  it("seeds exactly thirty reproducible users within 5km of actual anchor", () => {
    const anchor: [number, number] = [121.4, 31.2],
      date = new Date(2026, 8, 28, 12);
    const users = nearby(anchor, date);
    expect(users).toEqual(nearby(anchor, date));
    expect(users).toHaveLength(30);
    for (const p of users) {
      expect(
        metersFrom(
          {
            longitude: p.coordinate[0],
            latitude: p.coordinate[1],
            accuracy: 0,
            timestamp: 0,
            source: "simulation",
          },
          {
            lng: anchor[0],
            lat: anchor[1],
            enter: 80,
            exit: 120,
            code: "x",
            name: "x",
          },
        ),
      ).toBeLessThanOrEqual(5000);
      expect(p.arrival >= "08:30" && p.arrival <= "10:30").toBe(true);
      expect(p.leaving >= "17:00" && p.leaving <= "20:30").toBe(true);
    }
  });
});
