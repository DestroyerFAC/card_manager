/** Region of the card, as fractions of the card guide (0..1). */
export interface RelativeRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PixelRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Physical card ratio (63 × 88 mm). */
export const CARD_ASPECT = 63 / 88;

// Name banner (top-left, before the HP) and the whole bottom strip (the collector number sits
// bottom-left on modern cards and bottom-right on older ones).
export const NAME_REGION: RelativeRegion = { x: 0.04, y: 0.025, width: 0.72, height: 0.085 };
export const NUMBER_REGION: RelativeRegion = { x: 0.02, y: 0.885, width: 0.96, height: 0.095 };

/** Largest centred card-shaped rectangle that fits in `fill` of the frame. */
export function cardGuideRect(frameWidth: number, frameHeight: number, fill = 0.82): PixelRect {
  let height = frameHeight * fill;
  let width = height * CARD_ASPECT;
  if (width > frameWidth * fill) {
    width = frameWidth * fill;
    height = width / CARD_ASPECT;
  }
  return {
    x: Math.round((frameWidth - width) / 2),
    y: Math.round((frameHeight - height) / 2),
    width: Math.round(width),
    height: Math.round(height),
  };
}

export function regionToPixels(guide: PixelRect, region: RelativeRegion): PixelRect {
  return {
    x: Math.round(guide.x + guide.width * region.x),
    y: Math.round(guide.y + guide.height * region.y),
    width: Math.max(1, Math.round(guide.width * region.width)),
    height: Math.max(1, Math.round(guide.height * region.height)),
  };
}

/**
 * In-place grayscale + linear contrast stretch on RGBA pixels. Two O(n) passes; stretching
 * between the 2nd and 98th percentiles ignores glare and deep shadows that would otherwise
 * flatten the text contrast Tesseract relies on.
 */
export function enhanceForOcr(pixels: Uint8ClampedArray): void {
  const histogram = new Uint32Array(256);
  const count = pixels.length / 4;
  for (let i = 0; i < pixels.length; i += 4) {
    const luma = Math.round(
      0.299 * (pixels[i] ?? 0) + 0.587 * (pixels[i + 1] ?? 0) + 0.114 * (pixels[i + 2] ?? 0),
    );
    pixels[i] = luma;
    histogram[luma] = (histogram[luma] ?? 0) + 1;
  }

  const lowTarget = count * 0.02;
  const highTarget = count * 0.98;
  // low = first luma whose cumulative count exceeds 2 %, high = first reaching 98 %.
  let low = -1;
  let high = -1;
  let cumulative = 0;
  for (let value = 0; value < 256 && high === -1; value++) {
    cumulative += histogram[value] ?? 0;
    if (low === -1 && cumulative > lowTarget) low = value;
    if (cumulative >= highTarget) high = value;
  }
  low = Math.max(0, low);
  const range = Math.max(1, (high === -1 ? 255 : high) - low);

  for (let i = 0; i < pixels.length; i += 4) {
    const stretched = (((pixels[i] ?? 0) - low) * 255) / range;
    const value = stretched < 0 ? 0 : stretched > 255 ? 255 : stretched;
    pixels[i] = value;
    pixels[i + 1] = value;
    pixels[i + 2] = value;
  }
}

/** Upscale factor so small print reaches the ~30 px glyph height where LSTM is accurate. */
export function upscaleFactor(width: number, targetWidth = 1200, max = 3): number {
  if (width <= 0) return 1;
  return Math.min(max, Math.max(1, targetWidth / width));
}

export function cropForOcr(source: CanvasImageSource, rect: PixelRect): HTMLCanvasElement {
  const scale = upscaleFactor(rect.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(rect.width * scale);
  canvas.height = Math.round(rect.height * scale);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return canvas;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    source,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  enhanceForOcr(image.data);
  context.putImageData(image, 0, 0);
  return canvas;
}
