import { useEffect, useState } from "react";

const PIXELS = 48;

export function PixelPortrait({ src }: { src: string }) {
  const [rendered, setRendered] = useState<{
    source: string;
    url: string;
  } | null>(null);
  useEffect(() => {
    let active = true;
    const image = new Image();
    const loaded =
      typeof image.decode === "function"
        ? Promise.resolve().then(() => {
            image.src = src;
            return image.decode();
          })
        : new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(Error("Image could not be loaded"));
            image.src = src;
          });
    void loaded
      .then(() => {
        if (!active || !image.naturalWidth || !image.naturalHeight) return;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = PIXELS;
        const context = canvas.getContext("2d");
        if (!context) return;
        // Match the badge's square crop without changing the stored upload.
        const edge = Math.min(image.naturalWidth, image.naturalHeight);
        context.drawImage(
          image,
          (image.naturalWidth - edge) / 2,
          (image.naturalHeight - edge) / 2,
          edge,
          edge,
          0,
          0,
          PIXELS,
          PIXELS,
        );
        const url = canvas.toDataURL("image/png");
        if (active) setRendered({ source: src, url });
      })
      .catch(() => {
        /* Keep the source and grid overlay if rendering is unavailable. */
      });
    return () => {
      active = false;
    };
  }, [src]);
  return (
    <img
      className="profile-picture"
      src={rendered?.source === src ? rendered.url : src}
      alt="Badge portrait"
    />
  );
}
