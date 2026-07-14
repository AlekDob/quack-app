/** Light inline markdown for the live typewriter tail.
 *  Closed spans only — never re-runs the full block renderer (069). */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stashCodeSpans(raw: string, codes: string[]): string {
  return raw.replace(/`([^`\n]+)`/g, (_m, code: string) => {
    codes.push(`<code>${escapeHtml(code)}</code>`);
    return `<<CODE${codes.length - 1}>>`;
  });
}

function applyEmphasis(escaped: string): string {
  let out = escaped.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\n]+)\*([^*]|$)/g, "$1<em>$2</em>$3");
  return out.replace(/(^|[^_])_([^_\n]+)_([^_]|$)/g, "$1<em>$2</em>$3");
}

function restoreCodeSpans(html: string, codes: string[]): string {
  return html.replace(/&lt;&lt;CODE(\d+)&gt;&gt;/g, (_m, i: string) => {
    return codes[Number(i)] ?? "";
  });
}

/** Format revealed stream text: inline code + bold + italic when closed. */
export function formatStreamInline(raw: string): string {
  if (!raw) return "";
  const codes: string[] = [];
  const stashed = stashCodeSpans(raw, codes);
  return restoreCodeSpans(applyEmphasis(escapeHtml(stashed)), codes);
}
