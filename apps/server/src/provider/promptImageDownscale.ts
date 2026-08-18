// FILE: promptImageDownscale.ts
// Purpose: Cap prompt images so ACP/HTTP2 does not eat multi-megabyte screenshots.
// Layer: Provider adapter utilities

import { encode as encodeJpeg, decode as decodeJpeg } from "jpeg-js";
import { PNG } from "pngjs";

export const PROMPT_IMAGE_MAX_EDGE_PX = 1568;
export const PROMPT_IMAGE_SKIP_MAX_BYTES = 400 * 1024;
const JPEG_QUALITY = 80;

export type PromptImageDownscaleResult =
  | { readonly kind: "image"; readonly mimeType: string; readonly bytes: Uint8Array }
  | { readonly kind: "omit"; readonly reason: string };

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function resizeRgba(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;
  for (let y = 0; y < dstH; y++) {
    const srcY = Math.min(srcH - 1, Math.floor(y * yRatio));
    for (let x = 0; x < dstW; x++) {
      const srcX = Math.min(srcW - 1, Math.floor(x * xRatio));
      const si = (srcY * srcW + srcX) * 4;
      const di = (y * dstW + x) * 4;
      dst[di] = src[si] ?? 0;
      dst[di + 1] = src[si + 1] ?? 0;
      dst[di + 2] = src[si + 2] ?? 0;
      dst[di + 3] = src[si + 3] ?? 255;
    }
  }
  return dst;
}

function decodeRgba(bytes: Uint8Array): { width: number; height: number; data: Uint8Array } {
  if (isPng(bytes)) {
    const png = PNG.sync.read(Buffer.from(bytes));
    return { width: png.width, height: png.height, data: png.data };
  }
  if (isJpeg(bytes)) {
    const jpeg = decodeJpeg(bytes, { maxMemoryUsageInMB: 64 });
    return { width: jpeg.width, height: jpeg.height, data: jpeg.data };
  }
  throw new Error("unsupported image format");
}

export function downscalePromptImage(
  bytes: Uint8Array,
  mimeType?: string,
): PromptImageDownscaleResult {
  if (bytes.byteLength <= PROMPT_IMAGE_SKIP_MAX_BYTES) {
    const resolvedMimeType =
      mimeType?.trim() || (isJpeg(bytes) ? "image/jpeg" : isPng(bytes) ? "image/png" : undefined);
    if (resolvedMimeType) {
      return { kind: "image", mimeType: resolvedMimeType, bytes };
    }
  }

  try {
    const decoded = decodeRgba(bytes);
    const longest = Math.max(decoded.width, decoded.height);
    const scale = longest > PROMPT_IMAGE_MAX_EDGE_PX ? PROMPT_IMAGE_MAX_EDGE_PX / longest : 1;
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const rgba =
      scale === 1
        ? decoded.data
        : resizeRgba(decoded.data, decoded.width, decoded.height, width, height);
    const jpeg = encodeJpeg({ data: Buffer.from(rgba), width, height }, JPEG_QUALITY);
    return { kind: "image", mimeType: "image/jpeg", bytes: jpeg.data };
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    return { kind: "omit", reason: detail };
  }
}
