import { useEffect, useRef, useState } from "react";
import type { Workplace } from "../core/geofence";
import { validCoordinate, metersFrom } from "../core/geofence";
import type { Settings } from "../store";
import type { LocationSample } from "../location/types";
import {
  rememberPlace,
  savedPlaces,
  workplaceFor,
  reversePlace,
  type Place,
} from "../location/geocode";
import { downloadStreets, saveStreetPack } from "../geo/streets";
import {
  removeImage,
  storeImage,
  useBadgeImage,
  DEFAULT_MEDIA,
  OCTICONS_LICENSE,
  type MediaSlot,
} from "../media";
import { WorkplaceSearch } from "./WorkplaceSearch";
import { MapView } from "./Map";
import { simulatedSample } from "../geo/nearby";

function ImageField({
  slot,
  title,
  revision,
  fallback,
  onSaved,
  onError,
}: {
  slot: MediaSlot;
  title: string;
  revision: string;
  fallback: string;
  onSaved: (revision: string) => void;
  onError: (message: string) => void;
}) {
  const url = useBadgeImage(slot, revision, fallback);
  const saved = useRef(onSaved);
  saved.current = onSaved;
  return (
    <div className="image-field">
      <img src={url} alt={`${title} preview`} />
      <div>
        <span>{title}</span>
        <label className="upload-button">
          Upload
          <input
            aria-label={`Upload ${title.toLowerCase()}`}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                await storeImage(slot, file);
                saved.current(
                  `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                );
              } catch (error) {
                onError(
                  error instanceof Error
                    ? error.message
                    : "Image could not be saved.",
                );
              }
              event.target.value = "";
            }}
          />
        </label>
        {revision && (
          <button
            type="button"
            className="text-button"
            onClick={async () => {
              try {
                await removeImage(slot);
                onSaved("");
              } catch {
                onError("Image could not be reset.");
              }
            }}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
export function SettingsPage({
  config,
  update,
  work,

  sample,
  locationError,
  retryLocation,
  offlineReady,
  onCompany,
  onLog,
}: {
  config: Settings;
  update: (patch: Partial<Settings>) => void;
  work?: Workplace;

  sample: LocationSample | null;
  locationError: string;
  retryLocation: () => void;
  offlineReady: boolean;
  onCompany: (place: Place) => void;
  onLog: (message: string) => void;
}) {
  const [enter, setEnter] = useState(String(work?.enter ?? 80)),
    [exit, setExit] = useState(String(work?.exit ?? 120));
  const [lat, setLat] = useState(String(config.testLocation?.lat ?? "")),
    [lng, setLng] = useState(String(config.testLocation?.lng ?? ""));
  const [message, setMessage] = useState(""),
    [downloading, setDownloading] = useState(false);
  const reverseRequest = useRef<AbortController | null>(null);
  const latestConfig = useRef(config);
  latestConfig.current = config;
  useEffect(() => () => reverseRequest.current?.abort(), []);
  useEffect(() => {
    if (config.locationSource !== "custom") reverseRequest.current?.abort();
  }, [config.locationSource]);
  const setCustomLocation = (place: Place, resolveAddress = false) => {
    reverseRequest.current?.abort();
    update({ testLocation: place });
    if (!resolveAddress || !config.searchOnline) return;
    const request = new AbortController();
    reverseRequest.current = request;
    void reversePlace(place, request.signal)
      .then((named) => {
        const current = latestConfig.current.testLocation;
        if (
          named &&
          !request.signal.aborted &&
          latestConfig.current.locationSource === "custom" &&
          current?.lat === place.lat &&
          current.lng === place.lng
        )
          update({ testLocation: named });
      })
      .catch(() => {
        /* Coordinates remain available offline or if lookup fails. */
      });
  };
  const rangeDistance =
    work && config.testLocation
      ? Math.min(
          1000,
          Math.round(
            metersFrom(
              {
                latitude: config.testLocation.lat,
                longitude: config.testLocation.lng,
                accuracy: config.accuracy,
                timestamp: Date.now(),
                source: "simulation",
              },
              work,
            ),
          ),
        )
      : config.distance;

  useEffect(() => {
    setEnter(String(work?.enter ?? 80));
    setExit(String(work?.exit ?? 120));
  }, [work]);
  useEffect(() => {
    setLat(String(config.testLocation?.lat ?? ""));
    setLng(String(config.testLocation?.lng ?? ""));
  }, [config.testLocation]);
  const field = (key: keyof Settings["profile"], value: string) =>
    update({ profile: { ...config.profile, [key]: value } });
  const media = (slot: MediaSlot, revision: string) => {
    field(slot, revision);
    onLog(`${slot} image ${revision ? "saved" : "reset"}`);
  };
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
          ? "Map saved offline."
          : "Browser storage is full.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Download failed.");
    } finally {
      setDownloading(false);
    }
  };
  const foil = async (enabled: boolean) => {
    update({ foil: enabled });
    onLog(`Gravity reflection ${enabled ? "enabled" : "disabled"}`);
    if (enabled) {
      const motion = globalThis.DeviceOrientationEvent as
        | (typeof DeviceOrientationEvent & {
            requestPermission?: () => Promise<string>;
          })
        | undefined;
      if (motion?.requestPermission) {
        try {
          const result = await motion.requestPermission();
          if (result !== "granted")
            setMessage(
              "Motion access declined. Pointer reflection is available.",
            );
        } catch {
          setMessage("Motion unavailable. Pointer reflection is available.");
        }
      }
    }
  };
  return (
    <div className="settings-sections">
      <section className="settings-section">
        <div className="section-heading">
          <span>01</span>
          <h2>Info</h2>
        </div>
        <ImageField
          title="Profile photo"
          slot="avatar"
          revision={config.profile.avatar}
          fallback={DEFAULT_MEDIA.avatar}
          onSaved={(revision) => media("avatar", revision)}
          onError={setMessage}
        />
        <ImageField
          title="Company logo"
          slot="logo"
          revision={config.profile.logo}
          fallback={DEFAULT_MEDIA.logo}
          onSaved={(revision) => media("logo", revision)}
          onError={setMessage}
        />
        <label>
          Name
          <input
            aria-label="Name"
            maxLength={80}
            value={config.profile.name}
            onChange={(event) => field("name", event.target.value)}
          />
        </label>
        <label>
          Job title
          <input
            aria-label="Job title"
            maxLength={120}
            value={config.profile.title}
            onChange={(event) => field("title", event.target.value)}
          />
        </label>
        <label>
          Department <small>optional</small>
          <input
            aria-label="Department"
            maxLength={100}
            placeholder="—"
            value={config.profile.department}
            onChange={(event) => field("department", event.target.value)}
          />
        </label>
      </section>
      <section className="settings-section">
        <div className="section-heading">
          <span>02</span>
          <h2>Company location</h2>
        </div>
        <WorkplaceSearch
          label="Company address"
          sample={sample}
          onChoose={onCompany}
          compact
          online={config.searchOnline}
          placeholder={work?.name.split(", ")[0] || "Search company address"}
        />
        {work && <p className="selected-address">{work.name}</p>}
        {savedPlaces().length > 1 && (
          <label>
            Recent companies
            <select
              aria-label="Saved workplace"
              value={work?.code ?? ""}
              onChange={(event) => {
                const p = savedPlaces().find(
                  (place) => workplaceFor(place).code === event.target.value,
                );
                if (p) {
                  rememberPlace(p);
                  onCompany(p);
                }
              }}
            >
              {savedPlaces().map((p) => (
                <option key={workplaceFor(p).code} value={workplaceFor(p).code}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Current position
          <select
            aria-label="Location source"
            value={config.locationSource}
            onChange={(event) =>
              update({
                locationSource: event.target
                  .value as Settings["locationSource"],
              })
            }
          >
            <option value="browser">Browser location</option>
            <option value="custom">Custom location</option>
          </select>
        </label>
        {config.locationSource === "custom" && (
          <fieldset className="test-location-section">
            <legend>Custom location</legend>
            <WorkplaceSearch
              label="Custom location search"
              selectionMessage="Custom location set."
              placeholder={
                config.testLocation?.name || "Search your current location"
              }
              sample={null}
              compact
              showHistory={false}
              online={config.searchOnline}
              onChoose={(place) => {
                setCustomLocation(place);
                onLog("Custom location selected");
              }}
            />
            {config.testLocation && (
              <p className="selected-address">{config.testLocation.name}</p>
            )}
            <MapView
              work={work}
              sample={
                sample ??
                (work
                  ? {
                      latitude: work.lat,
                      longitude: work.lng,
                      accuracy: 0,
                      timestamp: Date.now(),
                      source: "simulation",
                    }
                  : null)
              }
              online={config.mapOnline}
              onSetLocation={(point) => {
                setCustomLocation(
                  {
                    name: `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`,
                    ...point,
                  },
                  true,
                );
                onLog("Custom location selected on map");
              }}
            />
            <p className="settings-note">
              Drag the pin or tap the map to set your position.
            </p>
            <details>
              <summary>Coordinates & distance</summary>
              <form
                className="coordinate-form"
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
                  setCustomLocation({
                    name: "Custom location",
                    lat: Number(lat),
                    lng: Number(lng),
                  });
                  onLog("Custom coordinates updated");
                }}
              >
                <label>
                  Latitude
                  <input
                    aria-label="Custom latitude"
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
                    aria-label="Custom longitude"
                    type="number"
                    step="any"
                    min="-180"
                    max="180"
                    value={lng}
                    onChange={(event) => setLng(event.target.value)}
                  />
                </label>
                <button>Set location</button>
              </form>
              <label>
                Distance{" "}
                <output>
                  {config.testLocation ? "Custom" : `${config.distance} m`}
                </output>
                <input
                  aria-label="Custom distance"
                  type="range"
                  min="0"
                  max="1000"
                  value={rangeDistance}
                  disabled={!work}
                  onChange={(event) => {
                    if (!work) return;
                    const distance = Number(event.target.value);
                    const point = simulatedSample(
                      work,
                      distance,
                      config.accuracy,
                    );
                    setCustomLocation({
                      name: `${distance} m from company`,
                      lat: point.latitude,
                      lng: point.longitude,
                    });
                  }}
                />
              </label>
              <label>
                Accuracy <output>{config.accuracy} m</output>
                <input
                  aria-label="Custom accuracy"
                  type="range"
                  min="0"
                  max="250"
                  value={config.accuracy}
                  onChange={(event) =>
                    update({ accuracy: Number(event.target.value) })
                  }
                />
              </label>
            </details>
          </fieldset>
        )}
        <form
          className="threshold-form"
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
              setMessage("Off-work threshold must exceed work threshold.");
              return;
            }
            update({ custom: { ...work, enter: a, exit: b } });
            onLog("Company thresholds updated");
            setMessage("Thresholds saved.");
          }}
        >
          <label>
            Work threshold <small>m</small>
            <input
              aria-label="Entry radius"
              type="number"
              min="0"
              value={enter}
              onChange={(event) => setEnter(event.target.value)}
            />
          </label>
          <label>
            Off-work threshold <small>m</small>
            <input
              aria-label="Exit radius"
              type="number"
              min="1"
              value={exit}
              onChange={(event) => setExit(event.target.value)}
            />
          </label>
          <button disabled={!work}>Save thresholds</button>
        </form>
        <ImageField
          title="Off-work image"
          slot="offwork"
          revision={config.profile.offwork}
          fallback={DEFAULT_MEDIA.offwork}
          onSaved={(revision) => media("offwork", revision)}
          onError={setMessage}
        />
      </section>
      <section className="settings-section">
        <div className="section-heading">
          <span>03</span>
          <h2>Additional</h2>
        </div>
        <div className="theme-buttons" role="group" aria-label="Theme">
          <button
            aria-pressed={config.theme === "light"}
            onClick={() => update({ theme: "light" })}
          >
            Light
          </button>
          <button
            aria-pressed={config.theme === "dark"}
            onClick={() => update({ theme: "dark" })}
          >
            Dark
          </button>
        </div>
        <div className="color-fields">
          {(["accent", "background", "card"] as const).map((key) => (
            <label key={key}>
              {key[0].toUpperCase() + key.slice(1)}
              <input
                aria-label={`${key} color`}
                type="color"
                value={config.colors[config.theme][key]}
                onChange={(event) =>
                  update({
                    colors: {
                      ...config.colors,
                      [config.theme]: {
                        ...config.colors[config.theme],
                        [key]: event.target.value,
                      },
                    },
                  })
                }
              />
            </label>
          ))}
        </div>
        <label className="setting-toggle">
          <span>
            Double-tap to switch status
            <small>
              Overrides location until disabled or location source changes.
            </small>
          </span>
          <input
            aria-label="Double-tap to switch status"
            type="checkbox"
            checked={config.doubleClickSwitch}
            onChange={(event) =>
              update({ doubleClickSwitch: event.target.checked })
            }
          />
        </label>
        <label className="setting-toggle">
          <span>
            Gravity / holographic reflection
            <small>Tilt your phone or move your pointer.</small>
          </span>
          <input
            aria-label="Gravity reflection"
            type="checkbox"
            checked={config.foil}
            onChange={(event) => void foil(event.target.checked)}
          />
        </label>
        {config.foil &&
          typeof globalThis.DeviceOrientationEvent !== "undefined" &&
          "requestPermission" in globalThis.DeviceOrientationEvent && (
            <button
              className="motion-permission"
              onClick={() => void foil(true)}
            >
              Enable device motion
            </button>
          )}
        <label className="setting-toggle">
          <span>Online address suggestions</span>
          <input
            type="checkbox"
            checked={config.searchOnline}
            onChange={(event) => update({ searchOnline: event.target.checked })}
          />
        </label>
        <label className="setting-toggle">
          <span>Online street map</span>
          <input
            type="checkbox"
            checked={config.mapOnline}
            onChange={(event) => update({ mapOnline: event.target.checked })}
          />
        </label>
        <div className="additional-actions">
          <button onClick={retryLocation}>Request location</button>
          <button
            disabled={!work || downloading}
            onClick={() => void download()}
          >
            {downloading ? "Saving…" : "Save offline map"}
          </button>
        </div>
        {locationError && <p className="settings-note">{locationError}</p>}
        <p className="settings-note">
          {offlineReady
            ? "Offline badge ready."
            : "Offline caching requires a production build."}
        </p>
        <a
          className="widget-link"
          href="#/widget"
          target="_blank"
          rel="noreferrer"
        >
          Open fullscreen badge ↗
        </a>
        <details className="asset-credits">
          <summary>Asset credits</summary>
          <p className="settings-note">
            GitHub mark: official Octicons, MIT. Default portrait: supplied
            reference. Off-work artwork: original project SVG.
          </p>
          <pre>{OCTICONS_LICENSE}</pre>
        </details>
      </section>
      {message && (
        <p className="settings-feedback" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
