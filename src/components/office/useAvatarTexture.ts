import { useState, useEffect, useRef } from 'react';
import { Texture, ImageSource } from 'pixi.js';
import { getAgentAvatar } from '../../utils/agentAvatars';

const TEX_SIZE = 128; // Offscreen canvas size (high-res for quality)

/**
 * Hook to load an agent avatar as a circular PixiJS Texture.
 * Draws the image on an offscreen canvas with circular clipping,
 * then wraps it as a PixiJS Texture. No mask needed in the render tree.
 *
 * Brain: fix-office-status-dot-chatloadingmap-key-mismatch
 */
export function useAvatarTexture(avatarFilename?: string): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  // Brain: memory-leak — track texture ref for explicit GPU cleanup on unmount/change
  const textureRef = useRef<Texture | null>(null);

  useEffect(() => {
    if (!avatarFilename) {
      setTexture(null);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const urlOrPromise = getAgentAvatar('', avatarFilename!);
        const url = typeof urlOrPromise === 'string'
          ? urlOrPromise
          : await urlOrPromise;

        if (url.startsWith('blob:')) blobUrlRef.current = url;

        // Load via HTMLImageElement (works with Tauri asset protocol)
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        await img.decode();

        if (cancelled) return;

        // Draw circular avatar on offscreen canvas
        const canvas = document.createElement('canvas');
        canvas.width = TEX_SIZE;
        canvas.height = TEX_SIZE;
        const ctx = canvas.getContext('2d')!;
        const r = TEX_SIZE / 2;

        ctx.beginPath();
        ctx.arc(r, r, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, 0, 0, TEX_SIZE, TEX_SIZE);

        // Wrap canvas into PixiJS Texture and track ref for cleanup
        const source = new ImageSource({ resource: canvas });
        const newTexture = new Texture({ source });
        textureRef.current = newTexture;
        setTexture(newTexture);
      } catch (err) {
        console.warn('[useAvatarTexture] Failed:', avatarFilename, err);
        if (!cancelled) setTexture(null);
      }
    }

    load();

    return () => {
      cancelled = true;

      // Destroy PixiJS texture to free GPU memory + underlying ImageSource
      if (textureRef.current) {
        try {
          textureRef.current.destroy(true); // true = also destroy the underlying source
        } catch {
          // WebGL context may already be lost — safe to ignore
        }
        textureRef.current = null;
      }

      // Clear React state to avoid stale texture reference
      setTexture(null);

      // Revoke blob URL after texture is destroyed
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [avatarFilename]);

  return texture;
}
