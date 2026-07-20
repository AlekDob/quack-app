import type { ImageAttachment } from "./imageAttach";
import { rehydrateAttachment } from "./imageAttach";

export interface QueuedImageMeta {
  id: string;
  path: string;
  name: string;
  /** Inline preview only — stripped before disk persist. */
  thumb?: string;
}

/** Live composer knobs snapshotted onto a queue item at enqueue time. */
export interface QueuedComposerKnobs {
  presetId: string | null;
  model: string;
  effort?: string;
  thinking?: boolean | null;
  permMode?: string | null;
}

export interface QueuedComposerMessage extends QueuedComposerKnobs {
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
  knobs: QueuedComposerKnobs,
): QueuedComposerMessage | null {
  const trimmed = text.trim();
  if (!trimmed && images.length === 0) return null;
  return {
    text: trimmed,
    presetId: knobs.presetId,
    model: knobs.model,
    ...(knobs.effort !== undefined ? { effort: knobs.effort } : {}),
    ...(knobs.thinking !== undefined ? { thinking: knobs.thinking } : {}),
    ...(knobs.permMode !== undefined ? { permMode: knobs.permMode } : {}),
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

function knobsFromRaw(o: Record<string, unknown>): QueuedComposerKnobs {
  const presetRaw = o.presetId;
  const presetId =
    presetRaw === null || presetRaw === undefined
      ? null
      : String(presetRaw);
  return {
    presetId,
    model: typeof o.model === "string" ? o.model : "",
    ...(typeof o.effort === "string" ? { effort: o.effort } : {}),
    ...(o.thinking === null || typeof o.thinking === "boolean"
      ? { thinking: o.thinking as boolean | null }
      : {}),
    ...(o.permMode === null || typeof o.permMode === "string"
      ? { permMode: o.permMode as string | null }
      : {}),
  };
}

export function stripQueueForPersist(
  queue: QueuedComposerMessage[],
): QueuedComposerMessage[] {
  return queue.map((item) => ({
    text: item.text,
    presetId: item.presetId ?? null,
    model: item.model ?? "",
    ...(item.effort !== undefined ? { effort: item.effort } : {}),
    ...(item.thinking !== undefined ? { thinking: item.thinking } : {}),
    ...(item.permMode !== undefined ? { permMode: item.permMode } : {}),
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
    if (typeof entry === "string") {
      return { text: entry, presetId: null, model: "" };
    }
    if (entry && typeof entry === "object" && "text" in entry) {
      const o = entry as Record<string, unknown>;
      return {
        text: String(o.text ?? ""),
        images: Array.isArray(o.images)
          ? (o.images as QueuedImageMeta[])
          : undefined,
        ...knobsFromRaw(o),
      };
    }
    return { text: String(entry), presetId: null, model: "" };
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
      out.push({
        id: meta.id,
        path: meta.path,
        name: meta.name,
        thumb: meta.thumb,
      });
      continue;
    }
    const att = await rehydrateAttachment(meta);
    if (att) out.push(att);
  }
  return out;
}

/** True when the item carries a usable agent/model snapshot. */
export function hasQueueKnobs(item: QueuedComposerMessage): boolean {
  return (
    Boolean(item.model) ||
    item.presetId !== null ||
    item.effort !== undefined ||
    item.thinking !== undefined ||
    item.permMode !== undefined
  );
}
