import { useEffect, useMemo, useState } from "react";
import { useBrowserLocation, useGeofence, useSettings } from "./store";
import { Charm } from "./animations";
import { MapView } from "./components/Map";
import { WorkplaceSearch } from "./components/WorkplaceSearch";
import { SettingsPage } from "./components/Settings";
import {
  rememberPlace,
  savedPlaces,
  workplaceFor,
  type Place,
} from "./location/geocode";
import { prepareOffline } from "./offline";

function useRoute() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const listener = () => setHash(location.hash);
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  return hash;
}
export default function App() {
  const hash = useRoute();
  const widget = hash.startsWith("#/widget");
  const settings = hash.startsWith("#/settings");
  const routeTest =
    hash.startsWith("#/test") ||
    hash.startsWith("#/debug") ||
    hash.startsWith("#/widget/test") ||
    (widget && new URLSearchParams(hash.split("?")[1]).get("env") === "test");
  const [lastEnvironment, setLastEnvironment] = useState(
    routeTest ? "test" : "production",
  );
  const settingsEnvironment = new URLSearchParams(hash.split("?")[1]).get(
    "env",
  );
  const test = settings
    ? (settingsEnvironment ?? lastEnvironment) === "test"
    : routeTest;
  const mode = test ? "test" : "production";
  useEffect(() => {
    if (!settings) setLastEnvironment(mode);
  }, [mode, settings]);
  const [config, update] = useSettings();
  // One browser watch begins immediately, even before a workplace is selected.
  const browser = useBrowserLocation();
  const history = useMemo(savedPlaces, [config.custom]);
  const code = new URLSearchParams(hash.split("?")[1]).get("code");
  const work = useMemo(
    () =>
      widget && code
        ? config.custom?.code === code
          ? config.custom
          : history.map(workplaceFor).find((place) => place.code === code)
        : (config.custom ?? undefined),
    [widget, code, config.custom, history],
  );
  const environmentConfig = {
    ...config,
    provider: test ? ("simulation" as const) : ("real" as const),
  };
  const { state, sample, error, distance } = useGeofence(
    work,
    environmentConfig,
    browser,
  );
  const [offlineReady, setOfflineReady] = useState(false);
  useEffect(() => {
    void prepareOffline().then(setOfflineReady);
  }, []);
  const choose = (place: Place) => {
    rememberPlace(place);
    const custom = workplaceFor(place);
    update({ custom, code: custom.code });
  };
  if (widget)
    return (
      <main
        className="standalone"
        data-environment={mode}
        aria-label={`${test ? "Test" : "Production"} widget`}
      >
        <Charm
          key={`${work?.code ?? "unselected"}:${mode}`}
          status={state.display}
          departure={state.departure}
        />
      </main>
    );
  const position = test
    ? (sample ??
      (config.testLocation
        ? {
            latitude: config.testLocation.lat,
            longitude: config.testLocation.lng,
            accuracy: config.accuracy,
            timestamp: Date.now(),
            source: "simulation" as const,
          }
        : null))
    : browser.sample;
  return (
    <div className="shell minimal-shell">
      <header>
        <span className="brand-mark" aria-label="Geo Work Charm">
          ◈
        </span>
        <nav aria-label="Main navigation">
          <a
            href="#/production"
            className={!test && !settings ? "active" : ""}
            aria-current={!test && !settings ? "page" : undefined}
          >
            Production
          </a>
          <a
            href="#/test"
            className={test && !settings ? "active" : ""}
            aria-current={test && !settings ? "page" : undefined}
          >
            Test
          </a>
          <a
            href={`#/settings?env=${mode}`}
            className={settings ? "active" : ""}
            aria-current={settings ? "page" : undefined}
          >
            Settings
          </a>
        </nav>
      </header>
      {settings ? (
        <>
          <SettingsPage
            config={config}
            update={update}
            work={work}
            locationError={browser.error}
            locationAvailable={Boolean(browser.sample)}
            retryLocation={browser.retry}
            offlineReady={offlineReady}
          />
          <details className="settings-diagnostics">
            <summary>Diagnostics</summary>
            <dl>
              {Object.entries({
                source: position?.source ?? "none",
                accuracy: position?.accuracy ?? "—",
                raw: state.raw,
                stable: state.stable,
                candidate: `${state.candidate} (${state.count}/2)`,
                departureEvents: state.departure,
                error,
              }).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </details>
        </>
      ) : (
        <main className="workspace" data-environment={mode}>
          <div className="workspace-toolbar">
            <div className="search-panel">
              <WorkplaceSearch
                sample={position}
                onChoose={choose}
                compact
                online={config.searchOnline}
              />
            </div>
            <div className="distance-readout">
              <span>Distance</span>
              <output aria-label="Distance">
                {distance === null
                  ? "—"
                  : Math.round(distance).toLocaleString()}
                <small> m</small>
              </output>
            </div>
          </div>
          {test && (
            <input
              className="test-distance"
              aria-label="Test distance"
              type="range"
              min="0"
              max="1000"
              value={
                config.testLocation && distance !== null
                  ? Math.min(1000, Math.round(distance))
                  : config.distance
              }
              onChange={(event) =>
                update({
                  distance: Number(event.target.value),
                  testLocation: null,
                })
              }
            />
          )}
          <div className="workspace-layout">
            <MapView
              key={mode}
              work={work}
              sample={position}
              online={config.mapOnline}
              onSetLocation={
                test
                  ? (point) =>
                      update({
                        testLocation: {
                          name: "Test location",
                          lat: point.lat,
                          lng: point.lng,
                        },
                      })
                  : undefined
              }
            />
            <section
              className="widget-preview"
              aria-label={`${test ? "Test" : "Production"} widget preview`}
            >
              <a
                className="widget-expand"
                href={`#/widget/${mode}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${test ? "Test" : "Production"} fullscreen widget`}
              >
                ⛶
              </a>
              <Charm
                key={`${work?.code ?? "unselected"}:${mode}`}
                status={state.display}
                departure={state.departure}
              />
            </section>
          </div>
        </main>
      )}
    </div>
  );
}
