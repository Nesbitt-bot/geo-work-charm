import type { LocationProvider } from "./types";
import { amapConfigured, loadAMap } from "./amap";
import { gcj02ToWgs84 } from "../geo/coordinates";
export const browserProvider: LocationProvider = {
  watch(next, error) {
    if (!navigator.geolocation) {
      error("Location unavailable. Choose simulation manually.");
      return () => {};
    }
    const id = navigator.geolocation.watchPosition(
      (p) =>
        next({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy,
          timestamp: p.timestamp,
          source: "browser",
        }),
      (e) => error(`${e.message}. Choose simulation manually.`),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
    return () => navigator.geolocation.clearWatch(id);
  },
};
export const preferredProvider: LocationProvider = {
  watch(next, error) {
    let closed = false,
      fallen = false,
      stop = () => {},
      interval: ReturnType<typeof setInterval> | undefined;
    const fallback = () => {
      if (closed || fallen) return;
      fallen = true;
      clearTimeout(timer);
      clearInterval(interval);
      stop();
      stop = browserProvider.watch(next, error);
    };
    const timer = setTimeout(fallback, 12000);
    if (!amapConfigured) fallback();
    else
      loadAMap()
        .then((sdk) => {
          if (closed || fallen) return;
          const geo = new sdk.Geolocation({
            enableHighAccuracy: true,
            timeout: 8000,
            convert: true,
          });
          const poll = () =>
            geo.getCurrentPosition(
              (
                status: string,
                r: { position: { lng: number; lat: number }; accuracy: number },
              ) => {
                if (closed || fallen) return;
                if (status !== "complete") {
                  fallback();
                  return;
                }
                clearTimeout(timer);
                const [longitude, latitude] = gcj02ToWgs84([
                  r.position.lng,
                  r.position.lat,
                ]);
                next({
                  latitude,
                  longitude,
                  accuracy: r.accuracy,
                  timestamp: Date.now(),
                  source: "amap",
                });
              },
            );
          poll();
          interval = setInterval(poll, 4000);
        })
        .catch(fallback);
    return () => {
      closed = true;
      clearTimeout(timer);
      clearInterval(interval);
      stop();
    };
  },
};
