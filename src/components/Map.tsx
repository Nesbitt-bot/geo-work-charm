import { useEffect, useMemo, useRef, useState } from "react";
import { nearby, type Neighbor } from "../geo/nearby";
import { wgs84ToGcj02 } from "../geo/coordinates";
import { amapConfigured, loadAMap } from "../location/amap";
import type { Workplace } from "../core/geofence";
import type { LocationSample } from "../location/types";
export function MapView({
  work,
  sample,
}: {
  work: Workplace;
  sample: LocationSample | null;
}) {
  const anchor: [number, number] = sample
      ? [sample.longitude, sample.latitude]
      : [work.lng, work.lat],
    key = anchor.map((n) => n.toFixed(3)).join(",");
  const people = useMemo(() => nearby(anchor), [key]),
    [selected, setSelected] = useState<Neighbor | null>(null),
    [ready, setReady] = useState(false),
    container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!amapConfigured || !container.current) return;
    let cancelled = false;
    let destroy = () => {};
    loadAMap()
      .then((sdk) => {
        if (cancelled) return;
        const center = wgs84ToGcj02(anchor),
          map = new sdk.Map(container.current, {
            center,
            zoom: 13,
            mapStyle: "amap://styles/dark",
          });
        destroy = () => map.destroy();
        map.on("complete", () => setReady(true));
        map.add(
          new sdk.Circle({
            center,
            radius: 5000,
            strokeColor: "#76948e",
            fillOpacity: 0.03,
          }),
        );
        for (const radius of [work.enter, work.exit])
          map.add(
            new sdk.Circle({
              center: wgs84ToGcj02([work.lng, work.lat]),
              radius,
              strokeColor: radius === work.enter ? "#99dfb6" : "#e5bd84",
              fillOpacity: 0.12,
            }),
          );
        map.add(
          new sdk.Marker({
            position: center,
            title: "You",
            content: '<span class="amap-you">YOU</span>',
          }),
        );
        map.add(
          new sdk.Marker({
            position: wgs84ToGcj02([work.lng, work.lat]),
            title: work.name,
          }),
        );
        people.forEach((p) => {
          const marker = new sdk.CircleMarker({
            center: wgs84ToGcj02(p.coordinate),
            radius: 5,
            fillColor: "#a6c6bd",
            fillOpacity: 0.8,
            strokeWeight: 0,
          });
          marker.on("click", () => setSelected(p));
          map.add(marker);
        });
      })
      .catch(() => setReady(false));
    return () => {
      cancelled = true;
      destroy();
      setReady(false);
    };
  }, [work, key]);
  const xy = (lng: number, lat: number, origin = anchor, scale = 0.048) => [
    300 +
      (lng - origin[0]) *
        111320 *
        Math.cos((origin[1] * Math.PI) / 180) *
        scale,
    300 - (lat - origin[1]) * 111320 * scale,
  ];
  const wp = xy(work.lng, work.lat),
    you = sample
      ? xy(sample.longitude, sample.latitude, [work.lng, work.lat], 0.65)
      : null;
  return (
    <section className="map-card">
      <div className="map-top">
        <span>THE NEIGHBORHOOD</span>
        <span className="tag">SIMULATED DATA · 30</span>
      </div>
      <div className="map-stage">
        <div ref={container} className={`amap ${ready ? "ready" : ""}`} />
        {!ready && (
          <svg
            className="overview"
            viewBox="0 0 600 600"
            role="img"
            aria-label="Schematic 5 kilometer neighborhood map"
          >
            <defs>
              <pattern
                id="grid"
                width="38"
                height="38"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(-18)"
              >
                <path d="M38 0H0V38" fill="none" stroke="#243139" />
              </pattern>
            </defs>
            <rect width="600" height="600" fill="url(#grid)" />
            <path d="M-20 450 Q150 310 280 400 T630 210" className="river" />
            <circle cx="300" cy="300" r="240" className="boundary" />
            {people.map((p) => {
              const [x, y] = xy(...p.coordinate);
              return (
                <g
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  aria-label={p.id}
                  onClick={() => setSelected(p)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setSelected(p);
                  }}
                  className="person"
                >
                  <circle cx={x} cy={y} r="10" fill="transparent" />
                  <circle
                    cx={x}
                    cy={y}
                    r="4"
                    fill={p.status === "WORKING" ? "#789d91" : "#d2b98c"}
                  />
                </g>
              );
            })}
            {Math.abs(wp[0] - 300) < 290 && Math.abs(wp[1] - 300) < 290 && (
              <g>
                <rect
                  x={wp[0] - 5}
                  y={wp[1] - 5}
                  width="10"
                  height="10"
                  fill="#edc78d"
                />
                <text x={wp[0] + 12} y={wp[1] - 10}>
                  WORKPLACE
                </text>
              </g>
            )}
            <circle cx="300" cy="300" r="8" fill="#a7eed0" />
            <circle
              cx="300"
              cy="300"
              r="17"
              fill="none"
              stroke="#a7eed0"
              opacity=".3"
            />
            <text x="320" y="323">
              {sample ? "YOU" : "DEMO ANCHOR"}
            </text>
            <text x="285" y="557">
              5 KM
            </text>
          </svg>
        )}
        <div className="inset">
          <span>WORKPLACE / LOCAL DETAIL</span>
          <svg viewBox="0 0 220 220">
            <circle cx="110" cy="110" r="78" className="exit-ring" />
            <circle cx="110" cy="110" r="52" className="enter-ring" />
            <rect x="106" y="106" width="8" height="8" fill="#edc78d" />
            {you && Math.hypot(you[0] - 300, you[1] - 300) < 103 && (
              <circle
                cx={you[0] - 190}
                cy={you[1] - 190}
                r="5"
                fill="#b6ffdc"
              />
            )}
            <text x="110" y="46">
              120 m
            </text>
            <text x="110" y="74">
              80 m
            </text>
          </svg>
          <small>
            {you && Math.hypot(you[0] - 300, you[1] - 300) >= 103
              ? "You are beyond this inset"
              : "Enter 80 m · Exit 120 m"}
          </small>
        </div>
      </div>
      <div className="map-bottom">
        <span>● You · ■ Workplace · ◦ Fictional neighbors</span>
        <span>{ready ? "AMap · GCJ-02" : "Schematic · not a street map"}</span>
      </div>
      {selected && (
        <div className="person-info">
          <button
            aria-label="Close person details"
            onClick={() => setSelected(null)}
          >
            ×
          </button>
          <strong>{selected.id} · simulated</strong>
          <p>
            {selected.workplace} · {selected.status.replace("_", " ")}
          </p>
          <small>
            Arrives {selected.arrival} / leaves {selected.leaving} · fictional
            schedule
          </small>
        </div>
      )}
    </section>
  );
}
