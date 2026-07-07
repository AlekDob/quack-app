// HTML preview — drawer + virtual tabs for agent-generated pages.

import type { ToolCall } from "./ai";
import { requestToolDrawer } from "./toolDrawer";

export interface HtmlPreviewPayload {
  html: string;
  title: string;
}

const stashByKey = new Map<string, HtmlPreviewPayload>();

export function isHtmlPath(path: string): boolean {
  return /\.html?$/i.test(path);
}

export function htmlPreviewKey(
  wsId: string,
  chatId: string | undefined,
  previewId: string,
): string {
  return `prev:${wsId}|${chatId ?? "_"}|${previewId}`;
}

export function parseHtmlPreviewKey(k: string): {
  wsId: string;
  chatId: string | undefined;
  previewId: string;
} | null {
  if (!k.startsWith("prev:")) return null;
  const body = k.slice(5);
  let i = 0;
  const take = (): string | null => {
    const j = body.indexOf("|", i);
    if (j < 0) return null;
    const s = body.slice(i, j);
    i = j + 1;
    return s;
  };
  const wsId = take();
  const chatRaw = take();
  const previewId = body.slice(i);
  if (!wsId || !chatRaw || !previewId) return null;
  return { wsId, chatId: chatRaw === "_" ? undefined : chatRaw, previewId };
}

export function stashHtmlPreview(key: string, payload: HtmlPreviewPayload): void {
  stashByKey.set(key, payload);
}

export function htmlPreviewPayload(key: string): HtmlPreviewPayload | null {
  return stashByKey.get(key) ?? null;
}

export function isHtmlPreviewTool(name: string): boolean {
  const n = name.toLowerCase();
  if (n === "showhtmlpreview" || n === "htmlpreview" || n === "previewhtml") {
    return true;
  }
  return n.includes("html_preview") || n.includes("htmlpreview");
}

function looksLikeHtml(raw: string): boolean {
  const s = raw.trim();
  if (!s.startsWith("<")) return false;
  return (
    s.startsWith("<!DOCTYPE") ||
    /^<html[\s>]/i.test(s) ||
    s.includes("</")
  );
}

export function htmlFromToolCall(
  call: ToolCall,
  result?: string,
): string | null {
  const args = call.function.arguments as Record<string, unknown>;
  for (const key of ["html", "content", "body", "srcdoc", "source"]) {
    const v = args[key];
    if (typeof v === "string" && looksLikeHtml(v)) return v;
  }
  if (typeof result === "string" && looksLikeHtml(result)) return result;
  return null;
}

export function htmlPreviewTitle(call: ToolCall): string {
  const args = call.function.arguments as Record<string, unknown>;
  if (typeof args.title === "string" && args.title.trim()) return args.title.trim();
  if (typeof args.name === "string" && args.name.trim()) return args.name.trim();
  return "HTML preview";
}

export function requestHtmlPreviewDrawer(
  html: string,
  title: string,
  subtitle?: string,
  onOpenInTab?: () => void,
): void {
  requestToolDrawer({
    title,
    subtitle,
    result: "",
    html,
    variant: "browser",
    onOpenInTab,
  });
}
