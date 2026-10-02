import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type CSSProperties,
} from "react";
import type { Settings } from "../store";
import type { Status } from "../core/geofence";
import { DEFAULT_MEDIA, useBadgeImage } from "../media";
import { OfficeScene } from "./OfficeScene";
import { PixelImage, PixelPortrait } from "./PixelPortrait";
import { pixelResolution } from "../pixel";

export function Badge({
  config,
  status,
  waitingMessage,
  distance,
  departure,
  manualDeparture,
  onMenu,
  onSwitchStatus,
}: {
  config: Settings;
  status: Status;
  waitingMessage: string;
  distance: number | null;
  departure: number;
  manualDeparture: number;
  onMenu: () => void;
  onSwitchStatus: () => void;
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
  const lastTap = useRef<{ at: number; x: number; y: number } | null>(null);
  const tapStart = useRef<{
    at: number;
    x: number;
    y: number;
    id: number;
  } | null>(null);
  const lastTouchSwitch = useRef(-Infinity);
  const interactive = (target: EventTarget | null) =>
    target instanceof Element &&
    !!target.closest("button, a, input, select, textarea");
  const pointerDown = (event: ReactPointerEvent) => {
    if (
      !config.doubleClickSwitch ||
      event.pointerType === "mouse" ||
      !event.isPrimary ||
      interactive(event.target)
    ) {
      tapStart.current = null;
      lastTap.current = null;
      return;
    }
    tapStart.current = {
      at: Date.now(),
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId,
    };
  };
  const pointerUp = (event: ReactPointerEvent) => {
    const start = tapStart.current;
    tapStart.current = null;
    if (!start || start.id !== event.pointerId || interactive(event.target))
      return;
    const at = Date.now(),
      x = event.clientX,
      y = event.clientY;
    if (at - start.at > 350 || Math.hypot(x - start.x, y - start.y) > 18) {
      lastTap.current = null;
      return;
    }
    const previous = lastTap.current;
    if (
      previous &&
      at - previous.at <= 350 &&
      Math.hypot(x - previous.x, y - previous.y) <= 32
    ) {
      lastTap.current = null;
      lastTouchSwitch.current = at;
      onSwitchStatus();
    } else lastTap.current = { at, x, y };
  };
  const [celebrating, setCelebrating] = useState(false),
    seen = useRef({ departure, manualDeparture });
  const previousStatus = useRef(status);
  const previousManualDeparture = useRef(manualDeparture);
  const [transition, setTransition] = useState<
    "lights-off" | "lights-on" | null
  >(null);
  useEffect(() => {
    const previous = previousStatus.current;
    previousStatus.current = status;
    const manualClockout = manualDeparture > previousManualDeparture.current;
    previousManualDeparture.current = manualDeparture;
    if (
      ((previous === "WORKING" || manualClockout) && status === "OFF_WORK") ||
      (previous === "OFF_WORK" && status === "WORKING")
    ) {
      setTransition(status === "OFF_WORK" ? "lights-off" : "lights-on");
      const reduced = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const timer = setTimeout(() => setTransition(null), reduced ? 900 : 3200);
      return () => clearTimeout(timer);
    }
    setTransition(null);
  }, [status, manualDeparture]);
  useEffect(() => {
    const changed =
      departure > seen.current.departure ||
      manualDeparture > seen.current.manualDeparture;
    seen.current = { departure, manualDeparture };
    if (changed && status === "OFF_WORK") {
      setCelebrating(true);
      const timer = setTimeout(() => setCelebrating(false), 3200);
      return () => clearTimeout(timer);
    }
    setCelebrating(false);
  }, [departure, manualDeparture, status]);
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
      className={`badge-front ${config.foil ? "has-foil" : ""} ${status === "OFF_WORK" ? "is-offwork" : ""} ${transition ? "has-office-transition" : ""}`}
      aria-label="Work badge"
      tabIndex={config.doubleClickSwitch ? 0 : undefined}
      aria-keyshortcuts={config.doubleClickSwitch ? "Enter Space" : undefined}
      onPointerDown={pointerDown}
      onPointerMove={(event) => {
        const start = tapStart.current;
        if (
          start &&
          Math.hypot(event.clientX - start.x, event.clientY - start.y) > 18
        ) {
          tapStart.current = null;
          lastTap.current = null;
        }
      }}
      onPointerUp={pointerUp}
      onPointerCancel={() => {
        tapStart.current = null;
        lastTap.current = null;
      }}
      onDoubleClick={(event) => {
        if (
          config.doubleClickSwitch &&
          !interactive(event.target) &&
          Date.now() - lastTouchSwitch.current > 500
        )
          onSwitchStatus();
      }}
      onKeyDown={(event) => {
        if (
          config.doubleClickSwitch &&
          event.target === event.currentTarget &&
          !event.repeat &&
          (event.key === "Enter" || event.key === " ")
        ) {
          event.preventDefault();
          onSwitchStatus();
        }
      }}
    >
      {status === "OFF_WORK" && (
        <div
          className={`offwork-scene ${celebrating ? "celebrating" : ""}`}
          aria-label={celebrating ? "Clocking out" : undefined}
        >
          {config.profile.offwork ? (
            <img
              key={`off-${departure}-${manualDeparture}`}
              className="offwork-picture"
              src={offwork}
              alt="Off-work display"
            />
          ) : (
            <OfficeScene key={`off-${departure}-${manualDeparture}`} />
          )}
        </div>
      )}
      <div className="badge-print">
        <header className="badge-header">
          <PixelImage
            kernel={config.pixelSize.logo}
            fit="contain"
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
        {status !== "OFF_WORK" && (
          <div className="badge-person">
            <div
              className="portrait-frame"
              style={
                {
                  "--portrait-pixels": pixelResolution(config.pixelSize.avatar),
                } as CSSProperties
              }
            >
              <PixelPortrait src={avatar} kernel={config.pixelSize.avatar} />
            </div>
            <h1>{config.profile.name || "Trance-0"}</h1>
            <p className="job-title">
              {config.profile.title || "Vibe coding engineer"}
            </p>
            {config.profile.department && (
              <p className="department">{config.profile.department}</p>
            )}
          </div>
        )}
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
      {transition && (
        <div
          className={`badge-transition ${transition}`}
          key={`${transition}-${manualDeparture}`}
        >
          <OfficeScene
            phase={transition}
            label={
              transition === "lights-off"
                ? "Office lights turning off"
                : "Office lights turning on"
            }
          />
        </div>
      )}
      {config.foil && (
        <>
          <div className="foil-spectrum" aria-hidden="true" />
          <div className="foil-glare" aria-hidden="true" />
        </>
      )}
    </section>
  );
}
