import artwork from "../assets/off-work.svg?raw";
import { useId, useMemo } from "react";

export function OfficeScene({
  phase = "off",
  label = "Off-work display",
}: {
  phase?: "off" | "lights-off" | "lights-on";
  label?: string;
}) {
  const id = useId().replace(/:/g, "");
  const svg = useMemo(
    () =>
      artwork
        .replace(/id="([^"]+)"/g, (_, name) => `id="${id}-${name}"`)
        .replace(/url\(#([^)]+)\)/g, (_, name) => `url(#${id}-${name})`),
    [id],
  );
  return (
    <div
      className={`office-scene ${phase}`}
      role="img"
      aria-label={label}
      // Only the bundled artwork is inlined; uploaded SVGs stay in image tags.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
