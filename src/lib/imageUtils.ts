import type { Adjustments, Rect } from './types';

export interface DecodedImage {
  image: CanvasImageSource;
  width: number;
  height: number;
  /** Frees the underlying resource (ImageBitmap or object URL). */
  close: () => void;
}

/** Largest dimension sent to the OCR engine; bigger images are downscaled. */
export const MAX_OCR_DIMENSION = 3600;

function waitForImage(img: HTMLImageElement): Promise<void> {
  if (typeof img.decode === 'function') {
    return img.decode().catch(
      () =>
        new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('image decode failed'));
        }),
    );
  }
  return new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('image decode failed'));
  });
}

/**
 * Decode a file into something drawable. Never mutates the user's original
 * file: callers work on a copy drawn into a canvas.
 */
export async function decodeImage(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close?.(),
      };
    } catch {
      // fall through to the <img> path (e.g. formats ImageBitmap cannot decode)
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await waitForImage(img);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) throw new Error('empty image');
    return { image: img, width, height, close: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function supportsCanvasFilter(ctx: CanvasRenderingContext2D): boolean {
  try {
    ctx.filter = 'brightness(150%)';
    const supported = ctx.filter !== 'none' && ctx.filter !== undefined;
    ctx.filter = 'none';
    return supported;
  } catch {
    return false;
  }
}

function adjustPixels(canvas: HTMLCanvasElement, adjustments: Adjustments): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  const { brightness, contrast, grayscale } = adjustments;
  if (brightness === 100 && contrast === 100 && !grayscale) return;

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const factorB = brightness / 100;
  const factorC = contrast / 100;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    r = (r - 128) * factorC + 128;
    g = (g - 128) * factorC + 128;
    b = (b - 128) * factorC + 128;
    r *= factorB;
    g *= factorB;
    b *= factorB;
    if (grayscale) {
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      r = luminance;
      g = luminance;
      b = luminance;
    }
    data[i] = Math.max(0, Math.min(255, r));
    data[i + 1] = Math.max(0, Math.min(255, g));
    data[i + 2] = Math.max(0, Math.min(255, b));
  }
  ctx.putImageData(image, 0, 0);
}

/**
 * Build the OCR input copy: rotation, brightness, contrast and grayscale are
 * applied to a fresh canvas so the original file stays untouched.
 */
export function renderProcessed(
  decoded: Pick<DecodedImage, 'image' | 'width' | 'height'>,
  adjustments: Adjustments,
  maxDimension: number = MAX_OCR_DIMENSION,
): HTMLCanvasElement {
  const rotated = adjustments.rotate === 90 || adjustments.rotate === 270;
  const rotatedWidth = rotated ? decoded.height : decoded.width;
  const rotatedHeight = rotated ? decoded.width : decoded.height;
  const scale = Math.min(1, maxDimension / Math.max(rotatedWidth, rotatedHeight));

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(rotatedWidth * scale));
  canvas.height = Math.max(1, Math.round(rotatedHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');

  const drawWidth = rotated ? canvas.height : canvas.width;
  const drawHeight = rotated ? canvas.width : canvas.height;

  const useFilter = supportsCanvasFilter(ctx);
  if (useFilter) {
    const parts: string[] = [];
    if (adjustments.grayscale) parts.push('grayscale(1)');
    if (adjustments.brightness !== 100) parts.push(`brightness(${adjustments.brightness}%)`);
    if (adjustments.contrast !== 100) parts.push(`contrast(${adjustments.contrast}%)`);
    ctx.filter = parts.length ? parts.join(' ') : 'none';
  }

  ctx.save();
  switch (adjustments.rotate) {
    case 90:
      ctx.translate(canvas.width, 0);
      ctx.rotate(Math.PI / 2);
      break;
    case 180:
      ctx.translate(canvas.width, canvas.height);
      ctx.rotate(Math.PI);
      break;
    case 270:
      ctx.translate(0, canvas.height);
      ctx.rotate(-Math.PI / 2);
      break;
    default:
      break;
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(decoded.image, 0, 0, drawWidth, drawHeight);
  ctx.restore();
  ctx.filter = 'none';

  if (!useFilter) adjustPixels(canvas, adjustments);
  return canvas;
}

/** Crop a region produced by the selection tool (already in processed pixels). */
export function cropCanvas(source: HTMLCanvasElement, rect: Rect): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.min(rect.width, source.width));
  canvas.height = Math.max(1, Math.min(rect.height, source.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');
  ctx.drawImage(
    source,
    rect.left,
    rect.top,
    canvas.width,
    canvas.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas;
}

/** Small JPEG preview used by history records (keeps IndexedDB tiny). */
export function makeThumbnail(source: HTMLCanvasElement | CanvasImageSource, width: number, height: number, maxSize = 240): string {
  const scale = Math.min(1, maxSize / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.72);
}

export function canvasToDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('canvas.toBlob failed'));
    }, type);
  });
}
