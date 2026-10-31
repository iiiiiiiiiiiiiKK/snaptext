import { describe, expect, it } from 'vitest';
import {
  MIN_SELECTION_PX,
  clamp,
  displayRectToImage,
  fitScale,
  imageRectToDisplay,
  isUsableSelection,
  rectFromPoints,
} from '../lib/geometry';

describe('rectFromPoints', () => {
  it('normalises drags performed in any direction', () => {
    const forward = rectFromPoints({ x: 10, y: 20 }, { x: 60, y: 70 });
    const backward = rectFromPoints({ x: 60, y: 70 }, { x: 10, y: 20 });
    expect(forward).toEqual({ left: 10, top: 20, width: 50, height: 50 });
    expect(backward).toEqual(forward);
  });
});

describe('isUsableSelection', () => {
  it('rejects clicks and hairline drags', () => {
    expect(isUsableSelection({ left: 0, top: 0, width: 0, height: 0 })).toBe(false);
    expect(isUsableSelection({ left: 0, top: 0, width: MIN_SELECTION_PX - 1, height: 40 })).toBe(false);
    expect(isUsableSelection({ left: 0, top: 0, width: MIN_SELECTION_PX, height: MIN_SELECTION_PX })).toBe(true);
  });
});

describe('displayRectToImage', () => {
  const display = { left: 100, top: 50, width: 400, height: 200 };
  const image = { width: 1600, height: 800 };

  it('scales a preview rectangle back to real pixels (2x preview)', () => {
    const result = displayRectToImage({ left: 150, top: 100, width: 100, height: 50 }, display, image);
    // 50px offset in a 400px-wide preview of a 1600px image = 200px
    expect(result).toEqual({ left: 200, top: 200, width: 400, height: 200 });
  });

  it('handles a zoomed-in preview (image larger than the box)', () => {
    const zoomed = { left: 0, top: 0, width: 3200, height: 1600 };
    const result = displayRectToImage({ left: 1600, top: 800, width: 800, height: 400 }, zoomed, image);
    expect(result).toEqual({ left: 800, top: 400, width: 400, height: 200 });
  });

  it('clamps a selection that runs past the image edge', () => {
    const result = displayRectToImage({ left: 400, top: 150, width: 200, height: 200 }, display, image);
    expect(result).toEqual({ left: 1200, top: 400, width: 400, height: 400 });
  });

  it('returns null for unusable or degenerate input', () => {
    expect(displayRectToImage({ left: 0, top: 0, width: 1, height: 1 }, display, image)).toBeNull();
    expect(displayRectToImage({ left: 0, top: 0, width: 100, height: 100 }, { ...display, width: 0 }, image)).toBeNull();
    expect(displayRectToImage({ left: 0, top: 0, width: 100, height: 100 }, display, { width: 0, height: 0 })).toBeNull();
  });
});

describe('imageRectToDisplay', () => {
  it('is the inverse of displayRectToImage', () => {
    const display = { left: 10, top: 10, width: 300, height: 150 };
    const image = { width: 1200, height: 600 };
    const rect = { left: 240, top: 120, width: 240, height: 60 };
    const onScreen = imageRectToDisplay(rect, display, image);
    expect(onScreen.width).toBeCloseTo(60);
    expect(onScreen.height).toBeCloseTo(15);
    const back = displayRectToImage(
      { left: display.left + onScreen.left, top: display.top + onScreen.top, width: onScreen.width, height: onScreen.height },
      display,
      image,
    );
    expect(back).toEqual(rect);
  });
});

describe('helpers', () => {
  it('clamps values', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
  });

  it('fits an image inside a viewport without upscaling', () => {
    expect(fitScale({ width: 100, height: 100 }, { width: 200, height: 200 })).toBe(1);
    expect(fitScale({ width: 400, height: 200 }, { width: 200, height: 200 })).toBe(0.5);
  });
});
