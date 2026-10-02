import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_PIXEL_SIZE,
  SAMPLE_SIZE,
  pixelResolution,
  outlinePixels,
  type PixelMethod,
} from "../pixel";

export function PixelImage({
  src,
  kernel = DEFAULT_PIXEL_SIZE,
  fit = "cover",
  className,
  alt,
  method = "mosaic",
}: {
  src: string;
  kernel?: number;
  fit?: "cover" | "contain";
  className?: string;
  alt: string;
  method?: PixelMethod;
}) {
  const [sampled, setSampled] = useState<{
    source: string;
    fit: string;
    canvas: HTMLCanvasElement;
    rgba?: Uint8ClampedArray;
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
        const rgba = context.getImageData?.(
          0,
          0,
          SAMPLE_SIZE,
          SAMPLE_SIZE,
        ).data;
        if (active) setSampled({ source: src, fit, canvas, rgba });
      })
      .catch(() => {
        /* Keep the original source if rendering is unavailable. */
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
      if (method === "outline" && sampled.rgba) {
        const image = context.createImageData(pixels, pixels);
        image.data.set(
          outlinePixels(sampled.rgba, SAMPLE_SIZE, SAMPLE_SIZE, pixels),
        );
        context.putImageData(image, 0, 0);
      } else
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
  }, [sampled, src, fit, pixels, method]);
  return <img className={className} src={rendered} alt={alt} />;
}
export function PixelPortrait({
  src,
  kernel = DEFAULT_PIXEL_SIZE,
  method = "outline",
}: {
  src: string;
  kernel?: number;
  method?: PixelMethod;
}) {
  return (
    <PixelImage
      src={src}
      kernel={kernel}
      method={method}
      className="profile-picture"
      alt="Badge portrait"
    />
  );
}
