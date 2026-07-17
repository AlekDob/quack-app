/** Highlight skill + feature tokens inside the composer textarea (Cursor-style). */

const ESC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);
}

type Span = { start: number; end: number; kind: "skill" | "feature" };

function pushSpan(spans: Span[], start: number, end: number, kind: Span["kind"]) {
  if (end <= start) return;
  for (const s of spans) {
    if (start < s.end && end > s.start) return;
  }
  spans.push({ start, end, kind });
}

/** Collect non-overlapping skill + feature token ranges in `text`. */
export function findComposerTokenSpans(
  text: string,
  skillNames: string[],
  featureSlug: string | null,
): Span[] {
  const spans: Span[] = [];
  if (featureSlug) {
    const token = `@${featureSlug}`;
    let from = 0;
    while (from < text.length) {
      const i = text.indexOf(token, from);
      if (i < 0) break;
      const after = i + token.length;
      const boundary =
        after >= text.length || /[\s.,;:!?)]/.test(text[after] ?? "");
      if (boundary) pushSpan(spans, i, after, "feature");
      from = after;
    }
  }
  const names = [...skillNames].sort((a, b) => b.length - a.length);
  for (const name of names) {
    const re = new RegExp(`(^|\\s)/(${escapeRegExp(name)})(?=\\s|$)`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const slash = (m.index ?? 0) + m[1]!.length;
      pushSpan(spans, slash, slash + 1 + name.length, "skill");
    }
  }
  spans.sort((a, b) => a.start - b.start);
  return spans;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** HTML for the backdrop mirror (escaped + colored spans). */
export function buildComposerHighlightHtml(
  text: string,
  skillNames: string[],
  featureSlug: string | null,
): string {
  if (!text) return "";
  const spans = findComposerTokenSpans(text, skillNames, featureSlug);
  if (spans.length === 0) return escapeHtml(text);
  let out = "";
  let cursor = 0;
  for (const s of spans) {
    if (s.start > cursor) out += escapeHtml(text.slice(cursor, s.start));
    const cls = s.kind === "skill" ? "tok-skill" : "tok-feature";
    out += `<span class="${cls}">${escapeHtml(text.slice(s.start, s.end))}</span>`;
    cursor = s.end;
  }
  if (cursor < text.length) out += escapeHtml(text.slice(cursor));
  return out;
}
