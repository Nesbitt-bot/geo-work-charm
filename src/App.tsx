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
  const initialTest =
    hash.startsWith("#/test") ||
    hash.startsWith("#/widget/test") ||
    new URLSearchParams(hash.split("?")[1]).get("env") === "test";
  const [mode, setMode] = useState<"production" | "test">(
    initialTest ? "test" : "production",
  );
  const [tab, setTab] = useState<"production" | "test" | "debugging">(
    hash.startsWith("#/debug")
      ? "debugging"
      : initialTest
        ? "test"
        : "production",
  );
  const [flipped, setFlipped] = useState(
    hash.startsWith("#/settings") || hash.startsWith("#/debug"),
  );
  const [desktopDismissed, setDesktopDismissed] = useState(false);
  useEffect(() => {
    if (hash.startsWith("#/test") || hash.startsWith("#/widget/test")) {
      setMode("test");
      setTab("test");
    } else if (
      hash.startsWith("#/production") ||
      hash.startsWith("#/widget/production")
    ) {
      setMode("production");
      setTab("production");
    }
    if (hash.startsWith("#/settings")) setFlipped(true);
    if (hash.startsWith("#/debug")) {
      setTab("debugging");
      setFlipped(true);
    }
  }, [hash]);
  const [config, update] = useSettings();
  const browser = useBrowserLocation();
  const history = useMemo(savedPlaces, [config.custom]);
  const code = new URLSearchParams(hash.split("?")[1]).get("code");
  const widget = hash.startsWith("#/widget");
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
    { ...config, provider: mode === "test" ? "simulation" : "real" },
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
    log(`Mode: ${mode}`);
  }, [mode, log]);
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
  const choose = (place: Place) => {
    rememberPlace(place);
    const custom = workplaceFor(place);
    update({ custom, code: custom.code });
    log("Company location selected");
  };
  const waitingMessage = !work
    ? "Demo badge"
    : !sample
      ? "Waiting for location"
      : sample.accuracy > 150 ||
          sample.accuracy < 0 ||
          !Number.isFinite(sample.accuracy)
        ? "Low location accuracy"
        : "Near workplace boundary";
  const position =
    mode === "test"
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
  const changeTab = (value: "production" | "test" | "debugging") => {
    setTab(value);
    if (value !== "debugging") setMode(value);
    const next =
      value === "debugging"
        ? `#/debug?env=${mode}`
        : widget
          ? `#/widget/${value}`
          : `#/${value}`;
    window.history.replaceState(null, "", next);
    setHash(next);
  };
  const close = () => {
    setFlipped(false);
    const next = widget ? `#/widget/${mode}` : `#/${mode}`;
    window.history.replaceState(null, "", next);
    setHash(next);
  };
  return (
    <main
      className={`badge-app theme-${config.theme}${widget ? " fullscreen-badge" : ""}`}
      style={themeStyle}
      data-environment={mode}
      data-card-tone={darkCard ? "dark" : "light"}
      aria-label={
        widget
          ? `${mode === "test" ? "Test" : "Production"} widget`
          : "Work badge app"
      }
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
              config={config}
              status={state.display}
              departure={state.departure}
              waitingMessage={waitingMessage}
              distance={distance}
              onMenu={() => setFlipped(true)}
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
            <nav className="mode-tabs" aria-label="Badge modes" role="tablist">
              {(["production", "test", "debugging"] as const).map((value) => (
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
              role="tabpanel"
              aria-label={`${tab} panel`}
            >
              {flipped &&
                (tab === "debugging" ? (
                  <Debugging logs={logs} onClear={() => setLogs([])} />
                ) : (
                  <SettingsPage
                    config={config}
                    update={update}
                    work={work}
                    test={tab === "test"}
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
