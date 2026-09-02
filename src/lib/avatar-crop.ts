/**
 * Geometry for the avatar cropper.
 *
 * Kept separate from the component and free of DOM types so the arithmetic —
 * which is the part that is easy to get subtly wrong — can be tested directly.
 *
 * Model: the image is scaled to *cover* a square viewport of `boxSize`, then
 * multiplied by a user `zoom` (>= 1) and shifted by an offset measured in
 * viewport pixels from centre. Offsets are clamped so the image can never be
 * dragged far enough to expose a gap at any edge.
 */

export type CropInput = {
  naturalWidth: number;
  naturalHeight: number;
  /** Side length of the square crop viewport, in CSS pixels. */
  boxSize: number;
  /** 1 = fit-to-cover. Larger zooms in. */
  zoom: number;
  /** Horizontal shift from centre, in viewport pixels. */
  offsetX: number;
  /** Vertical shift from centre, in viewport pixels. */
  offsetY: number;
};

/** The scale at which the image exactly covers the viewport. */
export function coverScale(
  naturalWidth: number,
  naturalHeight: number,
  boxSize: number,
): number {
  if (naturalWidth <= 0 || naturalHeight <= 0) return 1;
  return boxSize / Math.min(naturalWidth, naturalHeight);
}

/**
 * The furthest the image may be shifted along one axis before a gap appears.
 * Zero when the image is exactly the viewport size on that axis.
 */
export function maxOffset(scaledLength: number, boxSize: number): number {
  return Math.max(0, (scaledLength - boxSize) / 2);
}

export function clamp(value: number, limit: number): number {
  if (Number.isNaN(value)) return 0;
  const clamped = Math.min(limit, Math.max(-limit, value));
  // Math.max(-0, negative) yields -0, which is numerically fine but leaks into
  // comparisons and serialised transforms. Normalise it away.
  return clamped === 0 ? 0 : clamped;
}

/** Clamp an offset pair so no edge of the viewport is left uncovered. */
export function clampOffsets(input: CropInput): { offsetX: number; offsetY: number } {
  const { naturalWidth, naturalHeight, boxSize, zoom, offsetX, offsetY } = input;
  const scale = coverScale(naturalWidth, naturalHeight, boxSize) * zoom;
  return {
    offsetX: clamp(offsetX, maxOffset(naturalWidth * scale, boxSize)),
    offsetY: clamp(offsetY, maxOffset(naturalHeight * scale, boxSize)),
  };
}

export type DrawRect = { dx: number; dy: number; dw: number; dh: number };

/**
 * Where to draw the source image on an `outputSize` square canvas so the result
 * matches what the viewport is showing.
 */
export function computeDrawRect(input: CropInput, outputSize: number): DrawRect {
  const { naturalWidth, naturalHeight, boxSize } = input;
  const scale = coverScale(naturalWidth, naturalHeight, boxSize) * input.zoom;
  const { offsetX, offsetY } = clampOffsets(input);

  const drawnWidth = naturalWidth * scale;
  const drawnHeight = naturalHeight * scale;

  // Top-left of the image in viewport coordinates...
  const left = boxSize / 2 + offsetX - drawnWidth / 2;
  const top = boxSize / 2 + offsetY - drawnHeight / 2;

  // ...then rescaled from the viewport to the output canvas.
  const ratio = outputSize / boxSize;
  return {
    dx: left * ratio,
    dy: top * ratio,
    dw: drawnWidth * ratio,
    dh: drawnHeight * ratio,
  };
}

/**
 * Output type for a given source type. Cropping re-encodes, so an animated GIF
 * cannot survive; PNG is the closest lossless landing spot and keeps alpha.
 */
export function outputTypeFor(sourceType: string): "image/png" | "image/jpeg" {
  return sourceType === "image/png" || sourceType === "image/gif"
    ? "image/png"
    : "image/jpeg";
}

export function outputExtensionFor(outputType: string): string {
  return outputType === "image/png" ? "png" : "jpg";
}
