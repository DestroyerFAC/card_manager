import { describe, expect, it } from 'vitest';
import {
  CARD_ASPECT,
  cardGuideRect,
  enhanceForOcr,
  NAME_REGION,
  regionToPixels,
  upscaleFactor,
} from './imageProcessing';

describe('cardGuideRect', () => {
  it('keeps the card aspect ratio and stays centred in a portrait frame', () => {
    const rect = cardGuideRect(1080, 1920);
    expect(rect.width / rect.height).toBeCloseTo(CARD_ASPECT, 2);
    expect(rect.x * 2 + rect.width).toBeCloseTo(1080, -1);
    expect(rect.width).toBeLessThanOrEqual(1080);
  });

  it('is limited by height in a landscape frame', () => {
    const rect = cardGuideRect(1920, 1080);
    expect(rect.height).toBeCloseTo(1080 * 0.82, 0);
  });
});

describe('regionToPixels', () => {
  it('maps a relative region inside the guide', () => {
    const rect = regionToPixels({ x: 100, y: 200, width: 630, height: 880 }, NAME_REGION);
    expect(rect.x).toBe(125);
    expect(rect.y).toBe(222);
    expect(rect.width).toBe(454);
  });
});

describe('enhanceForOcr', () => {
  it('produces grayscale with stretched contrast', () => {
    // Two dull pixels: dark grey text on light grey card.
    const pixels = new Uint8ClampedArray([90, 90, 90, 255, 160, 160, 160, 255]);
    enhanceForOcr(pixels);
    expect(pixels[0]).toBe(pixels[1]);
    expect(pixels[0]).toBe(0);
    expect(pixels[4]).toBe(255);
    expect(pixels[3]).toBe(255);
  });

  it('handles a uniform image without dividing by zero', () => {
    const pixels = new Uint8ClampedArray([128, 128, 128, 255]);
    enhanceForOcr(pixels);
    expect(Number.isFinite(pixels[0])).toBe(true);
  });
});

describe('upscaleFactor', () => {
  it('upscales small crops but never beyond the cap', () => {
    expect(upscaleFactor(600)).toBe(2);
    expect(upscaleFactor(100)).toBe(3);
    expect(upscaleFactor(2000)).toBe(1);
    expect(upscaleFactor(0)).toBe(1);
  });
});
