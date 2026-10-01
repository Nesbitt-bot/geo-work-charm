import { useEffect, useState } from "react";
import type { Workplace } from "../core/geofence";
import { validCoordinate } from "../core/geofence";
import type { Settings as AppSettings } from "../store";
import { downloadStreets, saveStreetPack } from "../geo/streets";
import { rememberPlace, savedPlaces, workplaceFor } from "../location/geocode";

export function SettingsPage({
  config,
  update,
  work,
  locationError,
  locationAvailable,
  retryLocation,
  offlineReady,
}: {
  config: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
  work?: Workplace;
  locationError: string;
  locationAvailable: boolean;
  retryLocation: () => void;
  offlineReady: boolean;
}) {
  const [lat, setLat] = useState(config.testLocation?.lat.toString() ?? "");
  const [lng, setLng] = useState(config.testLocation?.lng.toString() ?? "");
  const [enter, setEnter] = useState(work?.enter.toString() ?? "80"),
    [exit, setExit] = useState(work?.exit.toString() ?? "120");
  const [message, setMessage] = useState(""),
    [downloading, setDownloading] = useState(false);
  useEffect(() => {
    setLat(config.testLocation?.lat.toString() ?? "");
    setLng(config.testLocation?.lng.toString() ?? "");
  }, [config.testLocation]);
  useEffect(() => {
    setEnter(work?.enter.toString() ?? "80");
    setExit(work?.exit.toString() ?? "120");
  }, [work]);
  const download = async () => {
    if (!work) return;
    setDownloading(true);
    setMessage("");
    try {
      const pack = await downloadStreets(
        work.lat,
        work.lng,
        new AbortController().signal,
      );
      setMessage(
        saveStreetPack(pack)
          ? "Map saved for offline use."
          : "Map loaded; browser storage is full.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Download failed.");
    } finally {
      setDownloading(false);
    }
  };
  return (
    <main className="settings-page">
      <h1>Settings</h1>
      <section className="settings-section">
        <h2>Location</h2>
        <p>
          {locationError ||
            (locationAvailable
              ? "Browser location active."
              : "Waiting for browser location.")}
        </p>
        <button onClick={retryLocation}>Request location</button>
      </section>
      <section className="settings-section">
        <h2>Test location</h2>
        <form
          className="settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (
              !lat.trim() ||
              !lng.trim() ||
              !validCoordinate(Number(lat), Number(lng))
            ) {
              setMessage("Enter valid latitude and longitude.");
              return;
            }
            update({
              testLocation: {
                name: "Test location",
                lat: Number(lat),
                lng: Number(lng),
              },
            });
            setMessage("Test location updated.");
          }}
        >
          <label>
            Latitude
            <input
              aria-label="Test latitude"
              type="number"
              step="any"
              min="-90"
              max="90"
              value={lat}
              onChange={(event) => setLat(event.target.value)}
            />
          </label>
          <label>
            Longitude
            <input
              aria-label="Test longitude"
              type="number"
              step="any"
              min="-180"
              max="180"
              value={lng}
              onChange={(event) => setLng(event.target.value)}
            />
          </label>
          <button type="submit">Set location</button>
          <button type="button" onClick={() => update({ testLocation: null })}>
            Use distance slider
          </button>
        </form>
        <label className="settings-slider">
          Accuracy <span>{config.accuracy} m</span>
          <input
            aria-label="Test accuracy"
            type="range"
            min="0"
            max="250"
            value={config.accuracy}
            onChange={(event) =>
              update({ accuracy: Number(event.target.value) })
            }
          />
        </label>
      </section>
      <section className="settings-section">
        <h2>Workplace</h2>
        {work && (
          <select
            aria-label="Saved workplace"
            value={work.code}
            onChange={(event) => {
              const place = savedPlaces().find(
                (p) => workplaceFor(p).code === event.target.value,
              );
              if (place) {
                rememberPlace(place);
                update({
                  custom: workplaceFor(place),
                  code: event.target.value,
                });
              }
            }}
          >
            {savedPlaces().map((place) => (
              <option
                key={workplaceFor(place).code}
                value={workplaceFor(place).code}
              >
                {place.name}
              </option>
            ))}
          </select>
        )}
        <form
          className="settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!work) return;
            const a = Number(enter),
              b = Number(exit);
            if (
              !enter.trim() ||
              !exit.trim() ||
              !Number.isFinite(a) ||
              !Number.isFinite(b) ||
              a < 0 ||
              b <= a
            ) {
              setMessage("Exit radius must exceed entry radius.");
              return;
            }
            update({ custom: { ...work, enter: a, exit: b } });
            setMessage("Geofence updated.");
          }}
        >
          <label>
            Entry radius (m)
            <input
              aria-label="Entry radius"
              type="number"
              min="0"
              value={enter}
              onChange={(event) => setEnter(event.target.value)}
            />
          </label>
          <label>
            Exit radius (m)
            <input
              aria-label="Exit radius"
              type="number"
              min="1"
              value={exit}
              onChange={(event) => setExit(event.target.value)}
            />
          </label>
          <button disabled={!work} type="submit">
            Save geofence
          </button>
        </form>
      </section>
      <section className="settings-section">
        <h2>Map & search</h2>
        <label className="setting-toggle">
          <input
            type="checkbox"
            checked={config.mapOnline}
            onChange={(event) => update({ mapOnline: event.target.checked })}
          />
          Online street map
        </label>
        <label className="setting-toggle">
          <input
            type="checkbox"
            checked={config.searchOnline}
            onChange={(event) => update({ searchOnline: event.target.checked })}
          />
          Online address suggestions
        </label>
        <button disabled={!work || downloading} onClick={() => void download()}>
          {downloading ? "Downloading…" : "Save workplace map offline"}
        </button>
        <p>
          {offlineReady
            ? "Offline app ready."
            : "Offline app caching is available in the production build."}
        </p>
      </section>
      <section className="settings-section">
        <h2>Fullscreen widgets</h2>
        <div className="widget-links">
          <a href="#/widget/production" target="_blank" rel="noreferrer">
            Production widget ↗
          </a>
          <a href="#/widget/test" target="_blank" rel="noreferrer">
            Test widget ↗
          </a>
        </div>
      </section>
      <p className="settings-feedback" role="status">
        {message}
      </p>
      <section className="settings-section">
        <h2>Local data</h2>
        <p>
          Selected addresses and preferences stay in this browser. Online maps
          and search contact OpenStreetMap services. Test locations are
          simulated; Production uses browser GPS.
        </p>
      </section>
    </main>
  );
}
