/**
 * Image compression utility for Claude API compatibility
 * Automatically compresses images to fit within API limits (5MB, 8000x8000 pixels)
 */

// Claude API limits
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_IMAGE_DIMENSION = 8000; // 8000x8000 pixels
export const RECOMMENDED_IMAGE_DIMENSION = 1568; // Claude recommended for performance

interface CompressionResult {
  blob: Blob;
  wasCompressed: boolean;
  originalSize?: number;
  compressedSize?: number;
  originalDimensions?: { width: number; height: number };
  compressedDimensions?: { width: number; height: number };
}

/**
 * Compress an image to fit within Claude API limits
 * @param file The image file to compress
 * @param maxDimension Maximum dimension (width or height) in pixels
 * @param quality JPEG quality (0-1), only applies to JPEG output
 * @returns Compressed blob and metadata
 */
export async function compressImage(
  file: File | Blob,
  maxDimension: number = RECOMMENDED_IMAGE_DIMENSION,
  quality: number = 0.85
): Promise<CompressionResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    const originalSize = file.size;

    img.onload = () => {
      URL.revokeObjectURL(url);
      const { width, height } = img;

      // Check if compression is needed
      const needsResize = width > maxDimension || height > maxDimension;
      const needsCompress = file.size > MAX_FILE_SIZE * 0.8; // Compress if > 4MB

      if (!needsResize && !needsCompress) {
        // No compression needed, return original
        resolve({
          blob: file,
          wasCompressed: false,
          originalSize,
          compressedSize: file.size,
          originalDimensions: { width, height },
          compressedDimensions: { width, height },
        });
        return;
      }

      // Calculate new dimensions maintaining aspect ratio
      let newWidth = width;
      let newHeight = height;

      if (needsResize) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        newWidth = Math.round(width * ratio);
        newHeight = Math.round(height * ratio);
      }

      // Create canvas and draw resized image
      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to create canvas context'));
        return;
      }

      // Use high quality image smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      // Determine output type - keep PNG for PNG files (preserves transparency)
      const fileType = file instanceof File ? file.type : 'image/png';
      const outputType = fileType === 'image/png' ? 'image/png' : 'image/jpeg';
      const outputQuality = outputType === 'image/jpeg' ? quality : undefined;

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const fileName = file instanceof File ? file.name : 'image';
            console.info(
              `[Image] Compressed ${fileName}: ${width}x${height} (${(originalSize / 1024).toFixed(0)}KB) → ${newWidth}x${newHeight} (${(blob.size / 1024).toFixed(0)}KB)`
            );
            resolve({
              blob,
              wasCompressed: true,
              originalSize,
              compressedSize: blob.size,
              originalDimensions: { width, height },
              compressedDimensions: { width: newWidth, height: newHeight },
            });
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        outputType,
        outputQuality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      // If we can't load the image, return original
      const fileName = file instanceof File ? file.name : 'image';
      console.warn(`[Image] Could not load ${fileName} for compression, using original`);
      resolve({
        blob: file,
        wasCompressed: false,
        originalSize,
        compressedSize: file.size,
      });
    };

    img.src = url;
  });
}

/**
 * Generate a human-readable compression message
 */
export function getCompressionMessage(result: CompressionResult): string | null {
  if (!result.wasCompressed) return null;

  const originalKB = result.originalSize ? Math.round(result.originalSize / 1024) : 0;
  const compressedKB = result.compressedSize ? Math.round(result.compressedSize / 1024) : 0;
  const savedPercent = originalKB > 0 ? Math.round((1 - compressedKB / originalKB) * 100) : 0;

  if (result.originalDimensions && result.compressedDimensions) {
    const { width: ow, height: oh } = result.originalDimensions;
    const { width: nw, height: nh } = result.compressedDimensions;
    return `Image compressed: ${ow}x${oh} → ${nw}x${nh} (${originalKB}KB → ${compressedKB}KB, -${savedPercent}%)`;
  }

  return `Image compressed: ${originalKB}KB → ${compressedKB}KB (-${savedPercent}%)`;
}

/**
 * Convert a Blob to base64 string (without data URL prefix)
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
