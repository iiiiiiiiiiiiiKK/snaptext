import type { Rect } from './types';

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Drags shorter than this (CSS px) are treated as a click, not a selection. */
export const MIN_SELECTION_PX = 8;

/** Turn two drag points into a normalised positive rectangle. */
export function rectFromPoints(a: Point, b: Point): Box {
  return {
    left: Math.min(a.x, b.x),
    top: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function isUsableSelection(box: Box): boolean {
  return box.width >= MIN_SELECTION_PX && box.height >= MIN_SELECTION_PX;
}

/**
 * Map a selection made on the *displayed* preview (which may be scaled by
 * zoom/rotation) onto the *real* pixel grid of the processed image.
 *
 * `display` is the on-screen rectangle of the rendered image (from
 * `getBoundingClientRect()`), so browser zoom, CSS scaling and devtools
 * emulation are all accounted for automatically.
 */
export function displayRectToImage(
  selection: Box,
  display: Box,
  image: Size,
): Rect | null {
  if (display.width <= 0 || display.height <= 0) return null;
  if (image.width <= 0 || image.height <= 0) return null;
  if (!isUsableSelection(selection)) return null;

  const scaleX = image.width / display.width;
  const scaleY = image.height / display.height;

  const left = clamp((selection.left - display.left) * scaleX, 0, image.width);
  const top = clamp((selection.top - display.top) * scaleY, 0, image.height);
  const right = clamp((selection.left + selection.width - display.left) * scaleX, 0, image.width);
  const bottom = clamp((selection.top + selection.height - display.top) * scaleY, 0, image.height);

  const width = Math.round(right - left);
  const height = Math.round(bottom - top);
  if (width < 2 || height < 2) return null;

  return { left: Math.round(left), top: Math.round(top), width, height };
}

/** Convert an image-space rectangle back into on-screen coordinates. */
export function imageRectToDisplay(rect: Rect, display: Box, image: Size): Box {
  const scaleX = display.width / image.width;
  const scaleY = display.height / image.height;
  return {
    left: rect.left * scaleX,
    top: rect.top * scaleY,
    width: rect.width * scaleX,
    height: rect.height * scaleY,
  };
}

/** Fit an image into a viewport while preserving the aspect ratio. */
export function fitScale(image: Size, viewport: Size): number {
  if (!image.width || !image.height) return 1;
  return Math.min(viewport.width / image.width, viewport.height / image.height, 1);
}
