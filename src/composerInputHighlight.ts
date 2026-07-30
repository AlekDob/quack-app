/** Highlight skill + feature + file tokens inside the composer textarea. */

const ESC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);
}

export type ComposerTokenKind = "skill" | "feature" | "file";

type Span = { start: number; end: number; kind: ComposerTokenKind };

function pushSpan(spans: Span[], start: number, end: number, kind: Span["kind"]) {
  if (end <= start) return;
  for (const s of spans) {
    if (start < s.end && end > s.start) return;
  }
  spans.push({ start, end, kind });
}

function pushAtTokens(
  spans: Span[],
  text: string,
  tokens: string[],
  kind: "feature" | "file",
) {
  const sorted = [...tokens].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const raw of sorted) {
    const token = `@${raw}`;
    let from = 0;
    while (from < text.length) {
      const i = text.indexOf(token, from);
      if (i < 0) break;
      const after = i + token.length;
      const boundary =
        after >= text.length || /[\s.,;:!?)]/.test(text[after] ?? "");
      if (boundary) pushSpan(spans, i, after, kind);
      from = after;
    }
  }
}

/** Collect non-overlapping skill + feature + file token ranges in `text`. */
export function findComposerTokenSpans(
  text: string,
  skillNames: string[],
  featureSlug: string | null,
  fileRels: string[] = [],
): Span[] {
  const spans: Span[] = [];
  if (featureSlug) pushAtTokens(spans, text, [featureSlug], "feature");
  pushAtTokens(spans, text, fileRels, "file");
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

const TOK_CLASS: Record<ComposerTokenKind, string> = {
  skill: "tok-skill",
  feature: "tok-feature",
  file: "tok-file",
};

/** HTML for the backdrop mirror (escaped + colored spans). */
export function buildComposerHighlightHtml(
  text: string,
  skillNames: string[],
  featureSlug: string | null,
  fileRels: string[] = [],
): string {
  if (!text) return "";
  const spans = findComposerTokenSpans(text, skillNames, featureSlug, fileRels);
  if (spans.length === 0) return escapeHtml(text);
  let out = "";
  let cursor = 0;
  for (const s of spans) {
    if (s.start > cursor) out += escapeHtml(text.slice(cursor, s.start));
    out += `<span class="${TOK_CLASS[s.kind]}">${escapeHtml(text.slice(s.start, s.end))}</span>`;
    cursor = s.end;
  }
  if (cursor < text.length) out += escapeHtml(text.slice(cursor));
  return out;
}
