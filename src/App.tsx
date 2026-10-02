import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useBrowserLocation, useGeofence, useSettings } from "./store";
import { Badge } from "./components/Badge";
import { SettingsPage } from "./components/Settings";
import { Debugging, type LogEntry } from "./components/Debugging";
import { MapView } from "./components/Map";
import {
  rememberPlace,
  savedPlaces,
  workplaceFor,
  type Place,
} from "./location/geocode";
import { prepareOffline } from "./offline";

export default function App() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const listener = () => setHash(location.hash);
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  const [tab, setTab] = useState<"settings" | "debugging">(
    hash.startsWith("#/debug") ? "debugging" : "settings",
  );
  const [flipped, setFlipped] = useState(
    hash.startsWith("#/settings") || hash.startsWith("#/debug"),
  );
  const [desktopDismissed, setDesktopDismissed] = useState(false);
  useEffect(() => {
    if (hash.startsWith("#/settings")) {
      setTab("settings");
      setFlipped(true);
    }
    if (
      hash.startsWith("#/badge") ||
      hash.startsWith("#/widget") ||
      hash.startsWith("#/production") ||
      hash.startsWith("#/test")
    )
      setFlipped(false);
    if (hash.startsWith("#/debug")) {
      setTab("debugging");
      setFlipped(true);
    }
  }, [hash]);
  const [config, update] = useSettings();
  const [widget] = useState(() => location.hash.startsWith("#/widget"));
  const [manualStatus, setManualStatus] = useState<
    "WORKING" | "OFF_WORK" | null
  >(null);
  const [manualDeparture, setManualDeparture] = useState(0);
  useEffect(() => {
    setManualStatus(null);
  }, [config.locationSource, config.doubleClickSwitch]);
  const browser = useBrowserLocation();
  const history = useMemo(savedPlaces, [config.custom]);
  const code = new URLSearchParams(hash.split("?")[1]).get("code");
  const work = useMemo(
    () =>
      widget && code
        ? config.custom?.code === code
          ? config.custom
          : history.map(workplaceFor).find((p) => p.code === code)
        : (config.custom ?? undefined),
    [widget, code, config.custom, history],
  );
  const { state, sample, error, distance } = useGeofence(
    work,
    {
      ...config,
      provider: config.locationSource === "custom" ? "simulation" : "real",
    },
    browser,
  );
  const [offlineReady, setOfflineReady] = useState(false);
  useEffect(() => {
    void prepareOffline().then(setOfflineReady);
  }, []);
  const [logs, setLogs] = useState<LogEntry[]>([]),
    sequence = useRef(0);
  const log = useCallback(
    (message: string, level: "info" | "warn" = "info") => {
      const entry = {
        id: ++sequence.current,
        at: new Date().toLocaleTimeString(),
        message,
        level,
      };
      setLogs((previous) => [entry, ...previous].slice(0, 200));
    },
    [],
  );
  useEffect(() => {
    log(`Location source: ${config.locationSource}`);
  }, [config.locationSource, log]);
  useEffect(
    () =>
      browser.subscribe((event) =>
        log(
          event.error
            ? `Location: ${event.error}`
            : `Browser fix received · accuracy ${event.sample?.accuracy ?? "—"} m`,
          event.error ? "warn" : "info",
        ),
      ),
    [browser.subscribe, log],
  );
  useEffect(() => {
    log(
      `Badge: ${state.display}${state.raw !== state.display ? ` · raw ${state.raw}` : ""}`,
    );
  }, [state.display, state.raw, log]);
  useEffect(() => {
    if (error && error !== "Waiting for location.") log(error, "warn");
  }, [error, log]);
  const switchStatus = () => {
    if (!config.doubleClickSwitch) return;
    const next = manualStatus === "OFF_WORK" ? "WORKING" : "OFF_WORK";
    setManualStatus(next);
    if (next === "OFF_WORK") setManualDeparture((value) => value + 1);
    log(`Manual badge: ${next} · location override`);
  };
  const choose = (place: Place) => {
    rememberPlace(place);
    const custom = workplaceFor(place);
    update({ custom, code: custom.code });
    log("Company location selected");
  };
  const waitingMessage = !work
    ? "Demo badge"
    : !sample
      ? config.locationSource === "custom"
        ? "Choose a custom location"
        : "Waiting for location"
      : sample.accuracy > 150 ||
          sample.accuracy < 0 ||
          !Number.isFinite(sample.accuracy)
        ? "Low location accuracy"
        : "Near workplace boundary";
  const position =
    config.locationSource === "custom"
      ? config.testLocation
        ? {
            latitude: config.testLocation.lat,
            longitude: config.testLocation.lng,
            accuracy: config.accuracy,
            timestamp: Date.now(),
            source: "simulation" as const,
          }
        : null
      : browser.sample;
  const palette = config.colors[config.theme];
  useEffect(() => {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", palette.background);
  }, [palette.background]);
  const channels = [1, 3, 5].map(
    (index) => parseInt(palette.card.slice(index, index + 2), 16) / 255,
  );
  const darkCard =
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 < 0.55;
  const themeStyle = {
    "--page-bg": palette.background,
    "--card-bg": palette.card,
    "--accent": palette.accent,
    "--text": darkCard ? "#ebf1e8" : "#26332c",
    "--muted": darkCard ? "#a1afa5" : "#728077",
    "--line": `color-mix(in srgb, ${palette.card} 86%, ${darkCard ? "#ffffff" : "#203326"} 14%)`,
    "--field-bg": `color-mix(in srgb, ${palette.card} 94%, ${darkCard ? "#ffffff" : "#203326"} 6%)`,
  } as CSSProperties;
  const front = useRef<HTMLDivElement>(null),
    back = useRef<HTMLDivElement>(null);
  const backContent = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (backContent.current) backContent.current.scrollTop = 0;
  }, [tab, flipped]);
  const focusStarted = useRef(false);
  useEffect(() => {
    if (!focusStarted.current) {
      focusStarted.current = true;
      return;
    }
    const timer = setTimeout(() => {
      const target = (flipped ? back : front).current;
      if (target?.contains(document.activeElement)) return;
      target
        ?.querySelector<HTMLButtonElement>(
          flipped ? ".close-settings" : ".menu-button",
        )
        ?.focus({ preventScroll: true });
    }, 750);
    return () => clearTimeout(timer);
  }, [flipped]);
  const changeTab = (value: "settings" | "debugging") => {
    setTab(value);
    const next = value === "debugging" ? "#/debug" : "#/settings";
    window.history.replaceState(null, "", next);
    setHash(next);
  };
  const close = () => {
    setFlipped(false);
    const next = widget ? "#/widget" : "#/badge";
    window.history.replaceState(null, "", next);
    setHash(next);
  };
  return (
    <main
      className={`badge-app theme-${config.theme}${widget ? " fullscreen-badge" : ""}`}
      style={themeStyle}
      data-location-source={config.locationSource}
      data-card-tone={darkCard ? "dark" : "light"}
      aria-label={widget ? "Badge widget" : "Work badge app"}
    >
      {!desktopDismissed && (
        <aside className="desktop-prompt">
          <span>Made for your phone. Open on mobile for the best view.</span>
          <button
            aria-label="Dismiss mobile recommendation"
            onClick={() => setDesktopDismissed(true)}
          >
            ×
          </button>
        </aside>
      )}
      <div className="card-scene">
        <div className={`badge-card ${flipped ? "is-flipped" : ""}`}>
          <div
            className="card-face card-front"
            ref={front}
            aria-hidden={flipped}
            inert={flipped}
          >
            <Badge
              key={config.locationSource}
              config={config}
              status={manualStatus ?? state.display}
              departure={state.departure}
              manualDeparture={manualDeparture}
              waitingMessage={waitingMessage}
              distance={distance}
              onMenu={() => setFlipped(true)}
              onSwitchStatus={switchStatus}
            />
          </div>
          <div
            className="card-face card-back"
            ref={back}
            aria-hidden={!flipped}
            inert={!flipped}
          >
            <div className="back-header">
              <span className="back-eyebrow">YOUR BADGE</span>
              <button
                className="close-settings"
                aria-label="Return to badge"
                onClick={close}
              >
                ↶
              </button>
            </div>
            <nav className="mode-tabs" aria-label="Badge panels" role="tablist">
              {(["settings", "debugging"] as const).map((value) => (
                <button
                  key={value}
                  role="tab"
                  aria-selected={tab === value}
                  onClick={() => changeTab(value)}
                >
                  {value[0].toUpperCase() + value.slice(1)}
                </button>
              ))}
            </nav>
            <div
              className="back-content"
              ref={backContent}
              role="tabpanel"
              aria-label={`${tab} panel`}
            >
              {flipped &&
                (tab === "debugging" ? (
                  <>
                    <section
                      className="debug-map"
                      aria-label="Location overview"
                    >
                      <h2>Location</h2>
                      <MapView
                        work={work}
                        sample={position}
                        online={config.mapOnline}
                      />
                      <p className="settings-note">
                        Work ≤ {work?.enter ?? 80} m · Off work ≥{" "}
                        {work?.exit ?? 120} m
                      </p>
                      {!position && (
                        <p className="settings-note">{waitingMessage}</p>
                      )}
                    </section>
                    <Debugging logs={logs} onClear={() => setLogs([])} />
                  </>
                ) : (
                  <SettingsPage
                    config={config}
                    update={update}
                    work={work}
                    sample={position}
                    onCompany={choose}
                    locationError={browser.error}
                    retryLocation={browser.retry}
                    offlineReady={offlineReady}
                    onLog={log}
                  />
                ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
