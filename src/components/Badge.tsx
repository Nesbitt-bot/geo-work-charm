import { useEffect, useRef, useState } from "react";
import type { Settings } from "../store";
import type { Status } from "../core/geofence";
import { DEFAULT_MEDIA, useBadgeImage } from "../media";

export function Badge({
  config,
  status,
  waitingMessage,
  distance,
  departure,
  onMenu,
}: {
  config: Settings;
  status: Status;
  waitingMessage: string;
  distance: number | null;
  departure: number;
  onMenu: () => void;
}) {
  const avatar = useBadgeImage(
    "avatar",
    config.profile.avatar,
    DEFAULT_MEDIA.avatar,
  );
  const logo = useBadgeImage("logo", config.profile.logo, DEFAULT_MEDIA.logo);
  const offwork = useBadgeImage(
    "offwork",
    config.profile.offwork,
    DEFAULT_MEDIA.offwork,
  );
  const face = useRef<HTMLElement>(null);
  const [celebrating, setCelebrating] = useState(false),
    seen = useRef(departure);
  useEffect(() => {
    if (departure > seen.current) {
      seen.current = departure;
      setCelebrating(true);
      const timer = setTimeout(() => setCelebrating(false), 3200);
      return () => clearTimeout(timer);
    }
    seen.current = departure;
    setCelebrating(false);
  }, [departure]);
  useEffect(() => {
    const element = face.current;
    if (!element) return;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!config.foil || reduced) {
      element.style.setProperty("--tilt-x", "0deg");
      element.style.setProperty("--tilt-y", "0deg");
      return;
    }
    let frame = 0;
    let neutral: { beta: number; gamma: number } | null = null;
    const apply = (x: number, y: number) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        element.style.setProperty("--shine-x", `${50 + x * 30}%`);
        element.style.setProperty("--shine-y", `${50 + y * 30}%`);
        element.style.setProperty("--tilt-x", `${-y * 4}deg`);
        element.style.setProperty("--tilt-y", `${x * 4}deg`);
      });
    };
    const motion = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return;
      neutral ??= { beta: event.beta, gamma: event.gamma };
      const x = Math.max(-1, Math.min(1, (event.gamma - neutral.gamma) / 28)),
        y = Math.max(-1, Math.min(1, (event.beta - neutral.beta) / 28));
      apply(x, y);
    };
    const pointer = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1,
        y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      apply(x, y);
    };
    const reset = () => apply(0, 0);
    window.addEventListener("deviceorientation", motion);
    element.addEventListener("pointermove", pointer);
    element.addEventListener("pointerleave", reset);
    return () => {
      window.removeEventListener("deviceorientation", motion);
      element.removeEventListener("pointermove", pointer);
      element.removeEventListener("pointerleave", reset);
      cancelAnimationFrame(frame);
    };
  }, [config.foil]);
  return (
    <section
      ref={face}
      className={`badge-front ${config.foil ? "has-foil" : ""}`}
      aria-label="Work badge"
    >
      <div className="badge-print">
        <header className="badge-header">
          <img
            className={
              config.profile.logo ? "company-logo" : "company-logo default-logo"
            }
            src={logo}
            alt="Company logo"
          />
          <span className="badge-slot" aria-hidden="true" />
          <button
            className="menu-button"
            aria-label="Open settings"
            onClick={onMenu}
          >
            <span />
            <span />
            <span />
          </button>
        </header>
        <div className="badge-person">
          <div
            aria-label={celebrating ? "Clocking out" : undefined}
            className={`portrait-frame ${status === "OFF_WORK" ? "is-offwork" : ""} ${celebrating ? "celebrating" : ""}`}
          >
            <img
              key={status === "OFF_WORK" ? `off-${departure}` : "portrait"}
              className={
                status === "OFF_WORK" ? "offwork-picture" : "profile-picture"
              }
              src={status === "OFF_WORK" ? offwork : avatar}
              alt={
                status === "OFF_WORK" ? "Off-work display" : "Badge portrait"
              }
            />
          </div>
          <h1>{config.profile.name || "Trance-0"}</h1>
          <p className="job-title">
            {config.profile.title || "Vibe coding engineer"}
          </p>
          {config.profile.department && (
            <p className="department">{config.profile.department}</p>
          )}
        </div>
        <footer className="badge-footer">
          <span
            className={`badge-status ${status.toLowerCase()}`}
            role="status"
          >
            <i />
            {status === "WORKING"
              ? "Working"
              : status === "OFF_WORK"
                ? "Off work"
                : waitingMessage}
          </span>
          {distance !== null && (
            <span className="badge-distance" aria-label="Distance">
              {Math.round(distance).toLocaleString()} m
            </span>
          )}
        </footer>
        <div className="badge-ruler" aria-hidden="true" />
      </div>
      {config.foil && (
        <>
          <div className="foil-spectrum" aria-hidden="true" />
          <div className="foil-glare" aria-hidden="true" />
        </>
      )}
    </section>
  );
}
