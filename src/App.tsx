import { useEffect, useState } from "react";
import type { Workplace } from "./core/geofence";
import { useGeofence, useSettings } from "./store";
import { Charm } from "./animations";
import { MapView } from "./components/Map";
function useRoute() {
  const [hash, set] = useState(location.hash);
  useEffect(() => {
    const listener = () => set(location.hash);
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  return hash;
}
export default function App() {
  const hash = useRoute(),
    widget = hash.startsWith("#/widget"),
    debug = hash.startsWith("#/debug");
  const [users, setUsers] = useState<Workplace[]>([]),
    [loadError, setLoadError] = useState(""),
    [config, update] = useSettings();
  const requested = new URLSearchParams(hash.split("?")[1] || "").get("code");
  const work = users.find(
    (u) => u.code === (widget && requested ? requested : config.code),
  );
  const { state, sample, error, distance } = useGeofence(work, config);
  const [demo, setDemo] = useState(-1);
  const steps = [
    { name: "Outside", distance: 220 },
    { name: "Approaching", distance: 100 },
    { name: "Inside", distance: 50 },
    { name: "Inside · confirmed", distance: 45 },
    { name: "Leaving · hysteresis", distance: 100 },
    { name: "Outside · clock out", distance: 160 },
  ];
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/users.json`)
      .then((r) => {
        if (!r.ok) throw Error("Unable to load demo workplaces");
        return r.json();
      })
      .then(setUsers)
      .catch((e) => setLoadError(String(e)));
  }, []);
  useEffect(() => {
    if (demo < 0) return;
    if (demo >= steps.length) {
      setDemo(-1);
      return;
    }
    update({
      provider: "simulation",
      distance: steps[demo].distance,
      accuracy: 15,
    });
    const timer = setTimeout(() => setDemo((n) => n + 1), 3300);
    return () => clearTimeout(timer);
  }, [demo]);
  if (!work)
    return (
      <main className="loading">
        {loadError ||
          (users.length
            ? "Unknown demo code. Use DEMO001, DEMO002 or DEMO003."
            : "Opening the neighborhood…")}
      </main>
    );
  if (widget)
    return (
      <main className="standalone">
        <Charm
          key={`${work.code}:${config.provider}`}
          status={state.display}
          departure={state.departure}
        />
      </main>
    );
  return (
    <div className="shell">
      <header>
        <a className="brand" href="#/">
          ◈ <span>geo / work charm</span>
        </a>
        <nav>
          <a className={!debug ? "active" : ""} href="#/">
            Neighborhood
          </a>
          <a className={debug ? "active" : ""} href="#/debug">
            Debug lab
          </a>
          <a
            href={`#/widget?code=${work.code}`}
            target="_blank"
            rel="noreferrer"
          >
            Open widget ↗
          </a>
        </nav>
      </header>
      <section className="intro">
        <div className="eyebrow">A SMALL RITUAL FOR THE END OF THE DAY</div>
        <h1>{debug ? "Test the threshold." : "Work ends. Life unfolds."}</h1>
        <p>
          {debug
            ? "Real rules. Fictional movement. Nothing leaves this browser."
            : "A quiet sense of place, and a little celebration when you leave."}
        </p>
      </section>
      <div className="layout">
        <MapView work={work} sample={sample} />
        <aside>
          <section className="panel">
            <div className="eyebrow">YOUR WORKPLACE</div>
            <label className="sr-only" htmlFor="workplace">
              Demo workplace
            </label>
            <select
              id="workplace"
              value={work.code}
              onChange={(e) => {
                setDemo(-1);
                update({ code: e.target.value });
              }}
            >
              {users.map((u) => (
                <option key={u.code} value={u.code}>
                  {u.name}
                </option>
              ))}
            </select>
            <div className={`status ${state.display.toLowerCase()}`}>
              ● {state.display.replace("_", " ")}
            </div>
            <div className="metrics">
              <div>
                <strong>
                  {distance === null
                    ? "—"
                    : Math.round(distance).toLocaleString()}
                  <small> m</small>
                </strong>
                <span>from workplace</span>
              </div>
              <div>
                <strong>
                  {sample ? Math.round(sample.accuracy) : "—"}
                  <small> m</small>
                </strong>
                <span>accuracy</span>
              </div>
            </div>
            <button
              className="primary"
              onClick={() => {
                setDemo(-1);
                update({ provider: "real" });
              }}
            >
              Enable location
            </button>
            <button
              onClick={() => {
                setDemo(-1);
                update({ provider: "simulation" });
              }}
            >
              Use simulated location
            </button>
            <p className="note">
              {error ||
                `${sample?.source.toUpperCase()} · ${sample && sample.accuracy > 150 ? "Unreliable; stable state held." : "Two reliable samples confirm a change."}`}
            </p>
          </section>
          <div className="preview">
            <Charm
              key={`${work.code}:${config.provider}`}
              status={state.display}
              departure={state.departure}
            />
          </div>
        </aside>
      </div>
      {debug && (
        <section className="panel debug">
          <div>
            <div className="eyebrow">SIMULATION CONTROLS</div>
            <h2>Walk through a workday.</h2>
            <label>
              Distance <strong>{config.distance} m</strong>
              <input
                aria-label="Mock distance"
                type="range"
                min="0"
                max="500"
                value={config.distance}
                onChange={(e) => {
                  setDemo(-1);
                  update({ provider: "simulation", distance: +e.target.value });
                }}
              />
            </label>
            <label>
              Accuracy <strong>{config.accuracy} m</strong>
              <input
                aria-label="Mock accuracy"
                type="range"
                min="0"
                max="250"
                value={config.accuracy}
                onChange={(e) => {
                  setDemo(-1);
                  update({ provider: "simulation", accuracy: +e.target.value });
                }}
              />
            </label>
            <button
              className="primary"
              disabled={demo >= 0}
              onClick={() => setDemo(0)}
            >
              {demo >= 0 ? steps[demo]?.name : "Run full departure demo →"}
            </button>
            <p className="note">
              Outside → approaching → inside → inside → leaving → outside. Each
              step lasts 3.3 seconds.
            </p>
          </div>
          <dl>
            {Object.entries({
              raw: state.raw,
              stable: state.stable,
              display: state.display,
              candidate: `${state.candidate} (${state.count}/2)`,
              lastTransition: state.lastTransition ?? "none",
              source: sample?.source ?? "none",
              departureEvents: state.departure,
            }).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <footer>
        <p>LOCAL BY DESIGN</p>
        <span>
          No accounts. No location history. No analytics. Nearby people are
          fictional, seeded demo data.
          <br />
          Location is processed here; optional map providers receive network
          requests. Proximity is not proof of building entry.
        </span>
        <a href="#/debug">Explore the geofence rules →</a>
      </footer>
    </div>
  );
}
