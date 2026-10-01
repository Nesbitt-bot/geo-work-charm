import { useEffect, useRef, useState } from "react";
import type { Status } from "../core/geofence";
function ClockOut() {
  return (
    <div className="clock-out" aria-label="Clocking out">
      <svg viewBox="0 0 200 160">
        <path className="trail" d="M20 120 Q70 50 150 65" />
        <g className="comet">
          <rect x="80" y="44" width="46" height="62" rx="18" />
          <circle cx="96" cy="68" r="3" />
          <circle cx="112" cy="68" r="3" />
          <path d="M96 82 Q104 90 112 82" />
        </g>
        <path d="M152 28v18m-9-9h18M45 54v10m-5-5h10" />
      </svg>
      <h2>Enough for today.</h2>
      <p>The rest of the day is yours.</p>
    </div>
  );
}
// TODO: replace registry entry with a commissioned animation. No third-party artwork.
export const animations = { clockOut: ClockOut };
export function Charm({
  status,
  departure,
  waitingMessage = "Waiting for location",
}: {
  status: Status;
  departure: number;
  waitingMessage?: string;
}) {
  const [playing, setPlaying] = useState(false),
    [time, setTime] = useState(new Date()),
    seen = useRef(departure);
  useEffect(() => {
    if (departure > seen.current) {
      setPlaying(true);
      const t = setTimeout(() => setPlaying(false), 3200);
      seen.current = departure;
      return () => clearTimeout(t);
    }
    seen.current = departure;
  }, [departure]);
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const Animation = animations.clockOut;
  return (
    <div className={`charm ${status.toLowerCase()}`}>
      <span className="charm-label">GEO / WORK CHARM</span>
      {playing && status !== "UNKNOWN" ? (
        <Animation />
      ) : (
        <div className="quiet">
          <div
            className={
              status === "WORKING"
                ? "breath"
                : status === "UNKNOWN"
                  ? "neutral-orb"
                  : "idle-orb"
            }
          >
            {status === "OFF_WORK" ? "✦" : ""}
          </div>
          <h2>
            {status === "WORKING"
              ? "Working"
              : status === "UNKNOWN"
                ? waitingMessage
                : "Off work"}
          </h2>
        </div>
      )}
      <time>
        {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </time>
    </div>
  );
}
