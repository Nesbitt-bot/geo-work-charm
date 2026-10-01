import { useCallback, useEffect, useState, useRef } from "react";
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
import { browserProvider } from "./location/providers";
import { simulatedSample } from "./geo/nearby";
import { rememberPlace, savedPlaces, workplaceFor } from "./location/geocode";
export interface Settings {
  code: string;
  provider: "manual" | "real" | "simulation";
  distance: number;
  accuracy: number;
  custom: Workplace | null;
  testLocation: { name: string; lat: number; lng: number } | null;
  searchOnline: boolean;
  mapOnline: boolean;
}
const defaults: Settings = {
  code: "",
  provider: "manual",
  distance: 220,
  accuracy: 15,
  custom: null,
  testLocation: null,
  searchOnline: true,
  mapOnline: true,
};

function validCustom(value: unknown): Workplace | null {
  if (!value || typeof value !== "object") return null;
  const c = value as Partial<Workplace>;
  return typeof c.code === "string" &&
    typeof c.name === "string" &&
    validCoordinate(c.lat ?? NaN, c.lng ?? NaN)
    ? {
        code: c.code,
        name: c.name,
        lat: c.lat as number,
        lng: c.lng as number,
        enter: Number.isFinite(c.enter) && c.enter! >= 0 ? c.enter! : 80,
        exit:
          Number.isFinite(c.exit) && c.exit! > (c.enter ?? 80) ? c.exit! : 120,
      }
    : null;
}
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
  const recent = savedPlaces()[0];
  const previous = validCustom(s.custom);
  const custom = recent
    ? {
        ...workplaceFor(recent),
        ...(previous?.code === workplaceFor(recent).code
          ? { enter: previous.enter, exit: previous.exit }
          : {}),
      }
    : previous?.code.startsWith("CUSTOM:")
      ? previous
      : null;
  // Migrate an explicitly chosen legacy custom address, never old demo defaults
  // or unselected suggestions from the previous geocoder cache.
  if (!recent && custom)
    rememberPlace({ name: custom.name, lat: custom.lat, lng: custom.lng });
  return {
    ...defaults,
    ...s,
    provider: ["manual", "real", "simulation"].includes(s.provider)
      ? s.provider
      : "manual",
    distance: Number.isFinite(s.distance) ? Math.max(0, s.distance) : 220,
    accuracy: Number.isFinite(s.accuracy) ? Math.max(0, s.accuracy) : 15,
    code: custom?.code ?? "",
    custom,
    testLocation:
      s.testLocation && validCoordinate(s.testLocation.lat, s.testLocation.lng)
        ? s.testLocation
        : null,
    searchOnline: s.searchOnline !== false,
    mapOnline: s.mapOnline !== false,
  };
}
export function useSettings() {
  const [value, set] = useState(settings);
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === "gw:settings")
        set((old) => {
          const next = settings();
          if (JSON.stringify(old.custom) === JSON.stringify(next.custom))
            next.custom = old.custom;
          return next;
        });
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
interface BrowserEvent {
  sample: LocationSample | null;
  error: string;
}
interface BrowserFeed extends BrowserEvent {
  subscribe?: (listener: (event: BrowserEvent) => void) => () => void;
  getSnapshot?: () => BrowserEvent;
}
export function useBrowserLocation() {
  const [sample, setSample] = useState<LocationSample | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const latest = useRef<BrowserEvent>({ sample: null, error: "" });
  const listeners = useRef(new Set<(event: BrowserEvent) => void>());
  const subscribe = useCallback((listener: (event: BrowserEvent) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);
  const getSnapshot = useCallback(() => latest.current, []);
  useEffect(() => {
    let active = true;
    setError("");
    const stop = browserProvider.watch(
      (value) => {
        if (active) {
          latest.current = { sample: value, error: "" };
          setSample(value);
          setError("");
          // The classifier sees every fix, even when React batches rendering.
          listeners.current.forEach((listener) => listener(latest.current));
        }
      },
      (message) => {
        if (active) {
          latest.current = { sample: null, error: message };
          setSample(null);
          setError(message);
          listeners.current.forEach((listener) => listener(latest.current));
        }
      },
    );
    return () => {
      active = false;
      stop();
    };
  }, [attempt]);
  return {
    sample,
    error,
    subscribe,
    getSnapshot,
    retry: () => setAttempt((value) => value + 1),
  };
}
export function useGeofence(
  work: Workplace | undefined,
  config: Settings,
  browser?: BrowserFeed,
) {
  const configRef = useRef(config);
  configRef.current = config;
  const consumeRef = useRef<((sample: LocationSample) => void) | null>(null);
  const errorRef = useRef<((message: string) => void) | null>(null);
  const delivered = useRef<LocationSample | null>(null);
  const [state, setState] = useState<State>(initialState),
    [sample, setSample] = useState<LocationSample | null>(null),
    [error, setError] = useState("Waiting for location.");
  useEffect(() => {
    delivered.current = null;
    if (!work) {
      setState(initialState());
      setSample(null);
      return;
    }
    let active = true,
      source: Source | undefined,
      lastTimestamp = -1,
      initialized = false,
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
        initialized = false;
      }
      if (Number.isFinite(s.timestamp) && s.timestamp <= lastTimestamp) return;
      if (
        !Number.isFinite(s.timestamp) ||
        !validCoordinate(s.latitude, s.longitude)
      ) {
        initialized = false;
        armed = false;
        setSample(null);
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
      if (current.raw === "UNKNOWN") {
        initialized = false;
        armed = false;
      }
      // Establish status from one reliable observation. Browser watches emit
      // on position changes, so a stationary user may never receive a second
      // fix. This bootstrap cannot create a departure event. Once initialized,
      // ordinary changes still require two distinct observations.
      if (!initialized && current.raw !== "UNKNOWN") {
        current = {
          ...current,
          stable: current.raw,
          display: current.raw,
          candidate: "UNKNOWN",
          count: 0,
          lastTransition: null,
          departure: previousDeparture,
        };
        initialized = true;
      }
      if (!armed) current.departure = previousDeparture;
      if (current.display === "WORKING" && current.raw === "WORKING")
        armed = true;
      setState(current);
      save(`gw:stable:${work.code}:${source}`, current.stable);
    };
    const unavailable = (message: string) => {
      if (!active) return;
      initialized = false;
      armed = false;
      setError(message);
      setSample(null);
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
      const tick = () => {
        const settings = configRef.current;
        const point = settings.testLocation;
        consume(
          point
            ? {
                longitude: point.lng,
                latitude: point.lat,
                accuracy: settings.accuracy,
                timestamp: Date.now(),
                source: "simulation",
              }
            : simulatedSample(work, settings.distance, settings.accuracy),
        );
      };
      tick();
      const id = setInterval(tick, 1100);
      stop = () => clearInterval(id);
    } else if (config.provider === "real") {
      consumeRef.current = consume;
      errorRef.current = unavailable;
      if (browser?.subscribe) {
        const receive = (event: BrowserEvent) => {
          if (event.error) unavailable(event.error);
          else if (event.sample && delivered.current !== event.sample) {
            delivered.current = event.sample;
            consume(event.sample);
          }
        };
        stop = browser.subscribe(receive);
        receive(browser.getSnapshot?.() ?? browser);
      }
    } else setError("Location is off. Enable it or choose simulation.");
    return () => {
      active = false;
      consumeRef.current = null;
      errorRef.current = null;
      stop();
    };
    // Changing mock values must not reset a confirmation streak: simulation uses a separate settings ref below.
  }, [work, config.provider, browser?.subscribe]);
  useEffect(() => {
    if (config.provider !== "real" || browser?.subscribe) return;
    if (browser?.error) errorRef.current?.(browser.error);
    else if (browser?.sample && delivered.current !== browser.sample) {
      delivered.current = browser.sample;
      consumeRef.current?.(browser.sample);
    }
  }, [
    work,
    config.provider,
    browser?.sample,
    browser?.error,
    browser?.subscribe,
  ]);
  return {
    state,
    sample,
    error,
    distance: sample && work ? metersFrom(sample, work) : null,
  };
}
