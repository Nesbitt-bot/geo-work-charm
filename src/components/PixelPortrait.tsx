import { useEffect, useMemo, useState } from "react";
import { DEFAULT_PIXEL_SIZE, SAMPLE_SIZE, pixelResolution } from "../pixel";

export function PixelImage({
  src,
  kernel = DEFAULT_PIXEL_SIZE,
  fit = "cover",
  className,
  alt,
}: {
  src: string;
  kernel?: number;
  fit?: "cover" | "contain";
  className?: string;
  alt: string;
}) {
  const [sampled, setSampled] = useState<{
    source: string;
    fit: string;
    canvas: HTMLCanvasElement;
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
        canvas.width = canvas.height = SAMPLE_SIZE;
        const context = canvas.getContext("2d");
        if (!context) return;
        if (fit === "cover") {
          const edge = Math.min(image.naturalWidth, image.naturalHeight);
          context.drawImage(
            image,
            (image.naturalWidth - edge) / 2,
            (image.naturalHeight - edge) / 2,
            edge,
            edge,
            0,
            0,
            SAMPLE_SIZE,
            SAMPLE_SIZE,
          );
        } else {
          const scale =
            SAMPLE_SIZE / Math.max(image.naturalWidth, image.naturalHeight);
          const width = image.naturalWidth * scale,
            height = image.naturalHeight * scale;
          context.drawImage(
            image,
            (SAMPLE_SIZE - width) / 2,
            (SAMPLE_SIZE - height) / 2,
            width,
            height,
          );
        }
        if (active) setSampled({ source: src, fit, canvas });
      })
      .catch(() => {
        /* Keep the source and grid overlay if rendering is unavailable. */
      });
    return () => {
      active = false;
    };
  }, [src, fit]);
  const pixels = pixelResolution(kernel);
  const rendered = useMemo(() => {
    if (!sampled || sampled.source !== src || sampled.fit !== fit) return src;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = pixels;
      const context = canvas.getContext("2d");
      if (!context) return src;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(
        sampled.canvas,
        0,
        0,
        SAMPLE_SIZE,
        SAMPLE_SIZE,
        0,
        0,
        pixels,
        pixels,
      );
      return canvas.toDataURL("image/png");
    } catch {
      return src;
    }
  }, [sampled, src, fit, pixels]);
  return <img className={className} src={rendered} alt={alt} />;
}
export function PixelPortrait({
  src,
  kernel = DEFAULT_PIXEL_SIZE,
}: {
  src: string;
  kernel?: number;
}) {
  return (
    <PixelImage
      src={src}
      kernel={kernel}
      className="profile-picture"
      alt="Badge portrait"
    />
  );
}
