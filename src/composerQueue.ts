import type { ImageAttachment } from "./imageAttach";
import { rehydrateAttachment } from "./imageAttach";

export interface QueuedImageMeta {
  id: string;
  path: string;
  name: string;
  /** Inline preview only — stripped before disk persist. */
  thumb?: string;
}

export interface QueuedComposerMessage {
  text: string;
  images?: QueuedImageMeta[];
}

const IMAGES_ONLY_PROMPT = "See the attached images.";

export function queuePromptText(item: QueuedComposerMessage): string {
  return item.text.trim() || (item.images?.length ? IMAGES_ONLY_PROMPT : "");
}

export function queueItemFromSend(
  text: string,
  images: ImageAttachment[],
): QueuedComposerMessage | null {
  const trimmed = text.trim();
  if (!trimmed && images.length === 0) return null;
  return {
    text: trimmed,
    ...(images.length > 0
      ? {
          images: images.map(({ id, path, name, thumb }) => ({
            id,
            path,
            name,
            thumb,
          })),
        }
      : {}),
  };
}

export function stripQueueForPersist(
  queue: QueuedComposerMessage[],
): QueuedComposerMessage[] {
  return queue.map((item) => ({
    text: item.text,
    ...(item.images?.length
      ? {
          images: item.images.map(({ id, path, name }) => ({ id, path, name })),
        }
      : {}),
  }));
}

/** Accept legacy `string[]` drafts and slim image metas. */
export function normalizeQueuedDraft(raw: unknown): QueuedComposerMessage[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map((entry) => {
    if (typeof entry === "string") return { text: entry };
    if (entry && typeof entry === "object" && "text" in entry) {
      const o = entry as QueuedComposerMessage;
      return { text: String(o.text ?? ""), images: o.images };
    }
    return { text: String(entry) };
  });
}

export async function rehydrateQueueItem(
  item: QueuedComposerMessage,
): Promise<QueuedComposerMessage> {
  if (!item.images?.length) return item;
  const images = await Promise.all(
    item.images.map(async (meta) => {
      if (meta.thumb) return meta;
      const att = await rehydrateAttachment(meta);
      return att ? { ...meta, thumb: att.thumb } : meta;
    }),
  );
  return { ...item, images };
}

export async function rehydrateQueue(
  queue: QueuedComposerMessage[],
): Promise<QueuedComposerMessage[]> {
  return Promise.all(queue.map(rehydrateQueueItem));
}

export async function queueImagesAsAttachments(
  item: QueuedComposerMessage,
): Promise<ImageAttachment[]> {
  if (!item.images?.length) return [];
  const out: ImageAttachment[] = [];
  for (const meta of item.images) {
    if (meta.thumb) {
      out.push({ id: meta.id, path: meta.path, name: meta.name, thumb: meta.thumb });
      continue;
    }
    const att = await rehydrateAttachment(meta);
    if (att) out.push(att);
  }
  return out;
}
