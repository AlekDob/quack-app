// Clickable workspace file paths in chat markdown + path resolution.

import { joinPath } from "./pathUtils";

const OPENABLE_EXT =
  /^(?:html?|mdx?|mmd|tsx?|jsx?|css|json|rs|py|toml|ya?ml|svg|txt|pdf|vue|svelte|excalidraw)$/i;

const BARE_FILE_RE =
  /(?:[\w.-]+\/)*[\w.-]+\.(?:html?|mdx?|mmd|tsx?|jsx?|css|json|rs|py|toml|ya?ml|svg|txt|pdf|vue|svelte|excalidraw)\b/gi;

/** Absolute Unix paths (`/Users/…/foo.pdf`) — BARE_FILE_RE skips these
 *  because a leading `/` looks like a mid-path segment boundary. */
const ABS_UNIX_FILE_RE =
  /\/(?:[\w.-]+\/)+[\w.-]+\.(?:html?|mdx?|mmd|tsx?|jsx?|css|json|rs|py|toml|ya?ml|svg|txt|pdf|vue|svelte|excalidraw)\b/gi;

const autoOpened = new Set<string>();

/** Strip `:42` / `:42:10` line refs agents append to paths. */
export function normalizeFileLinkPath(raw: string): string {
  return raw.trim().replace(/:(?:\d+)(?::\d+)?$/, "");
}

export function looksLikeOpenableFilePath(raw: string): boolean {
  const s = normalizeFileLinkPath(raw);
  if (!s || s.length > 280 || /\s/.test(s)) return false;
  if (/^https?:\/\//i.test(s) || /^mailto:/i.test(s)) return false;
  const base = s.split(/[\\/]/).pop() ?? s;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return false;
  return OPENABLE_EXT.test(base.slice(dot + 1));
}

export function resolveChatFilePath(wsRoot: string, raw: string): string {
  const p = raw.trim().replace(/\\/g, "/");
  const root = wsRoot.replace(/\\/g, "/").replace(/\/+$/, "");
  if (/^[A-Za-z]:\//.test(p) || p.startsWith("/")) return p;
  return joinPath(root, p);
}

/** Run a one-shot auto-open keyed by tool call id (survives re-renders). */
export function consumeAutoHtmlOpen(key: string): boolean {
  if (autoOpened.has(key)) return false;
  autoOpened.add(key);
  return true;
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

function wrapFileLink(path: string, innerHtml: string): string {
  return `<a class="md-file-link" href="#" data-file-link="${escapeAttr(path)}">${innerHtml}</a>`;
}

function linkifyAbsUnixPaths(text: string): string {
  return text.replace(ABS_UNIX_FILE_RE, (match, offset, whole) => {
    const before = whole[offset - 1] ?? "";
    // Avoid gluing onto a preceding path/URL segment (`x/Users/…`).
    if (before && /[\w.-]/.test(before)) return match;
    if (!looksLikeOpenableFilePath(match)) return match;
    return wrapFileLink(normalizeFileLinkPath(match), match);
  });
}

function linkifyRelFilePaths(text: string): string {
  return text.replace(BARE_FILE_RE, (match, offset, whole) => {
    const before = whole[offset - 1] ?? "";
    const after = whole[offset + match.length] ?? "";
    if (before === "/" || before === ".") return match;
    if (after === "/") return match;
    if (!looksLikeOpenableFilePath(match)) return match;
    return wrapFileLink(normalizeFileLinkPath(match), match);
  });
}

function linkifyBareFilePaths(html: string): string {
  const parts = html.split(/(<[^>]+>)/g);
  let inAnchor = 0;
  let inCode = 0;
  return parts
    .map((part) => {
      if (part.startsWith("<")) {
        if (/^<a[\s>]/i.test(part)) inAnchor++;
        else if (/^<\/a>/i.test(part)) inAnchor = Math.max(0, inAnchor - 1);
        else if (/^<code[\s>]/i.test(part)) inCode++;
        else if (/^<\/code>/i.test(part)) inCode = Math.max(0, inCode - 1);
        return part;
      }
      if (inAnchor > 0 || inCode > 0) return part;
      // Abs first so `/Users/…/a.pdf` isn't truncated to a relative tail.
      return linkifyRelFilePaths(linkifyAbsUnixPaths(part));
    })
    .join("");
}

/** Turn `<code>foo.html</code>` and bare `foo.md` paths into file links. */
export function enrichMarkdownWithFileLinks(html: string): string {
  let out = html.replace(/<code>([^<]+)<\/code>/g, (m, inner: string) => {
    const raw = decodeEntities(inner);
    if (!looksLikeOpenableFilePath(raw)) return m;
    const path = normalizeFileLinkPath(raw);
    return wrapFileLink(path, `<code>${inner}</code>`);
  });
  out = linkifyBareFilePaths(out);
  return out;
}
