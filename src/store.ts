import { useEffect, useState, useRef } from "react";
import {
  initialState,
  metersFrom,
  reduceSample,
  validCoordinate,
  type State,
  type Status,
  type Workplace,
} from "./core/geofence";
import type { LocationSample, Source } from "./location/types";
import { preferredProvider } from "./location/providers";
import { simulatedSample } from "./geo/nearby";
export interface Settings {
  code: string;
  provider: "manual" | "real" | "simulation";
  distance: number;
  accuracy: number;
}
const defaults: Settings = {
  code: "DEMO001",
  provider: "manual",
  distance: 220,
  accuracy: 15,
};
function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Private browsing may disable storage. */
  }
}
function settings(): Settings {
  const s = read<Settings>("gw:settings", defaults);
  return {
    ...defaults,
    ...s,
    provider: ["manual", "real", "simulation"].includes(s.provider)
      ? s.provider
      : "manual",
    distance: Number.isFinite(s.distance) ? Math.max(0, s.distance) : 220,
    accuracy: Number.isFinite(s.accuracy) ? Math.max(0, s.accuracy) : 15,
  };
}
export function useSettings() {
  const [value, set] = useState(settings);
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === "gw:settings") set(settings());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return [
    value,
    (patch: Partial<Settings>) =>
      set((old) => {
        const next = { ...old, ...patch };
        save("gw:settings", next);
        return next;
      }),
  ] as const;
}
export function useGeofence(work: Workplace | undefined, config: Settings) {
  const configRef = useRef(config);
  configRef.current = config;
  const [state, setState] = useState<State>(initialState),
    [sample, setSample] = useState<LocationSample | null>(null),
    [error, setError] = useState(
      "Location is off. Enable it or choose simulation.",
    );
  useEffect(() => {
    if (!work) return;
    let active = true,
      source: Source | undefined,
      lastTimestamp = -1,
      lastReceived = 0,
      armed = false;
    let current = initialState();
    setState(current);
    setSample(null);
    const consume = (s: LocationSample) => {
      if (!active) return;
      if (source !== s.source) {
        source = s.source;
        armed = false;
        const saved = read<Status>(
          `gw:stable:${work.code}:${source}`,
          "UNKNOWN",
        );
        current = initialState(
          ["WORKING", "OFF_WORK"].includes(saved) ? saved : "UNKNOWN",
        );
        lastTimestamp = -1;
      }
      if (
        !Number.isFinite(s.timestamp) ||
        s.timestamp <= lastTimestamp ||
        !validCoordinate(s.latitude, s.longitude)
      ) {
        current = {
          ...current,
          display: "UNKNOWN",
          raw: "UNKNOWN",
          candidate: "UNKNOWN",
          count: 0,
        };
        setState(current);
        return;
      }
      lastTimestamp = s.timestamp;
      lastReceived = Date.now();
      setSample(s);
      setError("");
      const previousDeparture = current.departure;
      current = reduceSample(
        current,
        metersFrom(s, work),
        s.accuracy,
        work.enter,
        work.exit,
      );
      if (!armed) current.departure = previousDeparture;
      if (current.display === "WORKING" && current.raw === "WORKING")
        armed = true;
      setState(current);
      save(`gw:stable:${work.code}:${source}`, current.stable);
    };
    const unavailable = (message: string) => {
      if (!active) return;
      setError(message);
      current = {
        ...current,
        display: "UNKNOWN",
        raw: "UNKNOWN",
        candidate: "UNKNOWN",
        count: 0,
      };
      setState(current);
    };
    let stop = () => {};
    if (config.provider === "simulation") {
      const tick = () =>
        consume(
          simulatedSample(
            work,
            configRef.current.distance,
            configRef.current.accuracy,
          ),
        );
      tick();
      const id = setInterval(tick, 1100);
      stop = () => clearInterval(id);
    } else if (config.provider === "real")
      stop = preferredProvider.watch(consume, unavailable);
    else setError("Location is off. Enable it or choose simulation.");
    const stale = setInterval(() => {
      if (lastReceived && Date.now() - lastReceived > 20000)
        unavailable("Waiting for a fresh position…");
    }, 5000);
    return () => {
      active = false;
      stop();
      clearInterval(stale);
    };
    // Changing mock values must not reset a confirmation streak: simulation uses a separate settings ref below.
  }, [work, config.provider]);
  return {
    state,
    sample,
    error,
    distance: sample && work ? metersFrom(sample, work) : null,
  };
}
