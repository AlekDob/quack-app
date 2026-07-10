// Tiny, dependency-free Markdown → HTML renderer covering the common subset:
// headings, paragraphs, fenced code blocks, inline code, bold, italic, links,
// images, ordered/unordered lists, blockquotes, hr, line breaks. Output is
// safe-by-default: every text segment is HTML-escaped before structural
// markup is layered on. Not CommonMark-compliant, but plenty for previews.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// URL scheme allowlist for the markdown renderer. Blocks `javascript:`,
// `data:`, `vbscript:` so a chat / file-preview can't be turned into an
// XSS vector by an AI hallucination, prompt injection, or a malicious
// pasted document. Relative URLs and #fragments fall through unchanged.
// Unknown schemes route to "#" for links and drop entirely for images.
function safeHrefUrl(raw: string): string {
  const stripped = raw.replace(/&amp;/g, "&").trimStart();
  if (/^[a-z][a-z0-9+.\-]*:/i.test(stripped)) {
    if (!/^(?:https?|mailto|tel|ftp|file):/i.test(stripped)) return "#";
  }
  return raw;
}
function safeImgUrl(raw: string): string {
  const stripped = raw.replace(/&amp;/g, "&").trimStart();
  if (/^[a-z][a-z0-9+.\-]*:/i.test(stripped)) {
    if (!/^(?:https?|file):/i.test(stripped)) return "";
  }
  return raw;
}

function inlineMd(s: string): string {
  // Inline code first so its contents don't get re-processed.
  let out = s.replace(/`([^`\n]+)`/g, (_m, code: string) => {
    return `<code>${escapeHtml(code)}</code>`;
  });
  // Escape what's left.
  // We need to escape carefully — placeholders for already-rendered code spans.
  const codes: string[] = [];
  // Placeholder uses < and > characters because escapeHtml below
  // rewrites them to &lt; / &gt;. The post-escape sentinel
  // ("&lt;&lt;CODE0&gt;&gt;") can't appear in user-supplied source
  // markdown — those characters would have been escaped already.
  // Means the restore step has no false-positive risk against text
  // that happens to contain "CODE0" or similar.
  out = out.replace(/<code>[\s\S]*?<\/code>/g, (m) => {
    codes.push(m);
    return `<<CODE${codes.length - 1}>>`;
  });
  out = escapeHtml(out);
  // Images: ![alt](src "title")
  out = out.replace(
    /!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g,
    (_m, alt, src, title) => {
      const safe = safeImgUrl(src);
      if (!safe) return alt; // Drop unsafe schemes, keep alt as plain text.
      return `<img alt="${alt}" src="${safe}"${title ? ` title="${title}"` : ""}>`;
    },
  );
  // Links: [text](url)
  out = out.replace(
    /\[([^\]]+)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g,
    (_m, text, url, title) => {
      const safe = safeHrefUrl(url);
      return `<a href="${safe}"${title ? ` title="${title}"` : ""} target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
  );
  // Bold (strong) — both ** and __
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
  // Italic (em) — both * and _
  out = out.replace(/(^|[^*])\*([^*\n]+)\*([^*]|$)/g, "$1<em>$2</em>$3");
  out = out.replace(/(^|[^_])_([^_\n]+)_([^_]|$)/g, "$1<em>$2</em>$3");
  // Auto-linkify bare URLs and email addresses. Runs late so existing
  // <a> tags from [text](url) markdown links and <code>…</code>
  // restored placeholders are present and skippable.
  //
  // Important context: by this point escapeHtml has already converted
  //   &  →  &amp;
  //   <  →  &lt;
  //   >  →  &gt;
  //   "  →  &quot;
  // and code-span placeholders <<CODE0>> have become &lt;&lt;CODE0&gt;&gt;.
  // The URL/email regexes must therefore tolerate "&amp;" inside URLs
  // (real query strings get escaped this way) and must NOT cross HTML
  // tag boundaries or re-linkify URLs already inside an <a>.
  //
  // Trace table (input → produced anchor tag):
  //   https://example.com/foo?bar=1&baz=2#hash
  //     → after escape: https://example.com/foo?bar=1&amp;baz=2#hash
  //     → href: https://example.com/foo?bar=1&amp;baz=2#hash (kept as-is)
  //     → visible: https://example.com/foo?bar=1&baz=2#hash (decoded)
  //   (see https://example.com) → ) excluded by char class, paren stays outside
  //   before:https://example.com,after → trailing ',' stripped, link stops there
  //   support@ → no TLD → does NOT match
  //   dev+tag@sub.example.co.uk → matches as email
  //   <<CODE0>> (placeholder) → ` becomes &lt;&lt;CODE0&gt;&gt; →
  //     URL pattern requires scheme so won't match; email pattern
  //     forbids '&' immediately before the local part so the trailing
  //     '0' inside the placeholder cannot be glued onto a preceding
  //     "@".
  out = autoLinkify(out);
  // Restore code spans. Match the post-escape form so a literal
  // "<<CODE0>>" the user happens to write goes through the escape
  // pipeline first and won't trigger the restore.
  out = out.replace(/&lt;&lt;CODE(\d+)&gt;&gt;/g, (_m, idx: string) => codes[+idx]);
  return out;
}

// Decode the subset of HTML entities escapeHtml emits, so a URL whose
// query string contains "&amp;" becomes user-readable "&" in the
// link's visible text. Conservative: only the four entities we
// produce. The href attribute keeps the encoded form (browsers
// resolve entities in attribute values too).
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

// Strip trailing punctuation that's almost certainly NOT part of the
// URL: sentence-enders and a closing paren when the URL itself
// doesn't contain a balancing open paren. Also handles a trailing
// "&amp;" left over from escaping (rare but avoids dangling href).
function trimUrlTrail(url: string): { url: string; trail: string } {
  let trail = "";
  // Repeatedly peel one offender at a time so combinations like
  // "https://x.com/." or "https://x.com)." all collapse cleanly.
  // Cap iterations defensively.
  for (let i = 0; i < 8; i++) {
    const last = url[url.length - 1];
    if (last === "." || last === "," || last === "!" || last === "?" ||
        last === ";" || last === ":") {
      trail = last + trail;
      url = url.slice(0, -1);
      continue;
    }
    if (last === ")" && !url.includes("(")) {
      trail = last + trail;
      url = url.slice(0, -1);
      continue;
    }
    if (url.endsWith("&amp;")) {
      trail = "&amp;" + trail;
      url = url.slice(0, -"&amp;".length);
      continue;
    }
    break;
  }
  return { url, trail };
}

function autoLinkify(html: string): string {
  // Walk the html string, copying through anything inside an existing
  // tag (<a …>…</a> in particular) untouched. We only linkify text
  // segments that fall *between* tags. The HTML we generate above is
  // well-formed enough for a tiny tokenizer: split on '<' boundaries.
  //
  // To avoid re-linkifying URLs inside an existing <a>…</a>, track an
  // "in anchor" depth. We don't need a full HTML parser — just match
  // <a …> opens and </a> closes case-insensitively.
  const parts: string[] = [];
  let i = 0;
  let inAnchor = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      const tail = html.slice(i);
      parts.push(inAnchor > 0 ? tail : linkifyTextSegment(tail));
      break;
    }
    const text = html.slice(i, lt);
    parts.push(inAnchor > 0 ? text : linkifyTextSegment(text));
    // Find end of the tag. Tags here are simple — no quoted '>' inside
    // attributes for the markup we generate.
    const gt = html.indexOf(">", lt);
    if (gt === -1) {
      // Malformed; emit the rest verbatim.
      parts.push(html.slice(lt));
      break;
    }
    const tag = html.slice(lt, gt + 1);
    parts.push(tag);
    if (/^<a\b/i.test(tag)) inAnchor++;
    else if (/^<\/a\s*>/i.test(tag)) inAnchor = Math.max(0, inAnchor - 1);
    i = gt + 1;
  }
  return parts.join("");
}

function linkifyTextSegment(text: string): string {
  // URL pattern: scheme + non-space, non-'<', non-')', non-',' run.
  // - We exclude '<' so we never grab into a tag boundary (defensive
  //   even though the caller already split on '<').
  // - We exclude ')' so "(see https://x.com)" leaves the paren outside.
  // - We exclude '"' / "'" so URLs inside attributes (shouldn't happen
  //   here, but defensive) won't be re-eaten.
  // - We exclude ',' so "before:https://x.com,after" doesn't glue
  //   ",after" onto the URL. Real URLs basically never use unescaped
  //   commas; encoded commas (%2C) still match.
  // - We allow '&' because escapeHtml has already turned literal '&'
  //   into '&amp;' and we want those captured.
  const URL_RE = /\b(https?:\/\/|mailto:)[^\s<>"'),]+/g;

  // Email pattern: tighter. Local part is word chars plus a few marks;
  // domain requires at least one dot and a 2+ letter TLD. Negative
  // lookbehind for ';' or '&' immediately before so we don't grab the
  // tail of a stray HTML entity (e.g. "&lt;" -> after escape, won't
  // match anyway since '<' is gone, but stay conservative).
  const EMAIL_RE = /(?<![A-Za-z0-9._%+\-&;])[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;

  // Two-pass strategy: collect non-overlapping matches from both
  // patterns ordered by index, then rebuild the string. Doing them in
  // one pass with alternation works too, but separate regexes keep
  // each pattern simpler.
  type Hit = { start: number; end: number; href: string; visible: string };
  const hits: Hit[] = [];
  let m: RegExpExecArray | null;
  while ((m = URL_RE.exec(text)) !== null) {
    const raw = m[0];
    const { url, trail } = trimUrlTrail(raw);
    if (!url) continue;
    const safe = safeHrefUrl(url);
    if (safe === "#") continue; // unknown scheme — leave text alone
    hits.push({
      start: m.index,
      end: m.index + url.length,
      href: safe,
      visible: decodeEntities(url),
    });
    // The trailing punctuation is left in `text` and will be emitted
    // by the gap copy below — no need to advance past it.
    void trail;
  }
  while ((m = EMAIL_RE.exec(text)) !== null) {
    const raw = m[0];
    // Strip trailing punctuation that the domain class might over-eat
    // (e.g. "user@example.com." → email is everything before the
    // dot). Word boundary already handles most cases; this is belt
    // and braces.
    let addr = raw;
    while (addr.length > 0 && /[.,!?;:]$/.test(addr)) addr = addr.slice(0, -1);
    if (!addr.includes("@")) continue;
    // After trimming the domain must still end in a 2+ letter TLD.
    if (!/\.[A-Za-z]{2,}$/.test(addr)) continue;
    hits.push({
      start: m.index,
      end: m.index + addr.length,
      href: `mailto:${addr}`,
      visible: addr,
    });
  }
  if (hits.length === 0) return text;
  // Sort and drop overlaps (URL match wins over an email substring).
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: Hit[] = [];
  for (const h of hits) {
    if (merged.length && h.start < merged[merged.length - 1].end) continue;
    merged.push(h);
  }
  let out = "";
  let cursor = 0;
  for (const h of merged) {
    out += text.slice(cursor, h.start);
    out += `<a href="${h.href}" target="_blank" rel="noopener noreferrer">${h.visible}</a>`;
    cursor = h.end;
  }
  out += text.slice(cursor);
  return out;
}

export interface Block {
  kind:
    | "heading"
    | "paragraph"
    | "code"
    | "ul"
    | "ol"
    | "tasklist"
    | "table"
    | "quote"
    | "hr"
    | "blank";
  level?: number;
  lang?: string;
  text?: string;
  items?: string[];
  /** For tasklist: parallel to items[], true when [x], false when [ ]. */
  checked?: boolean[];
  /** For tables: header row + body rows + per-column alignment. */
  table?: {
    header: string[];
    rows: string[][];
    aligns: Array<"left" | "center" | "right" | null>;
  };
  /** 1-based line number of the block's first source line. Set by
   *  tokenize so the rendered HTML can carry a data-source-line
   *  attribute, enabling click-to-jump from the markdown preview
   *  back into the editor. */
  line?: number;
}

function tokenize(md: string): Block[] {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const blockLine = i + 1;
    // Fenced code block
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const lang = fence[1] ?? "";
      i++;
      const start = i;
      while (i < lines.length && !lines[i].match(/^```\s*$/)) i++;
      blocks.push({
        kind: "code",
        lang,
        text: lines.slice(start, i).join("\n"),
        line: blockLine,
      });
      i++; // skip closing fence (or end)
      continue;
    }
    // Heading
    const h = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (h) {
      blocks.push({
        kind: "heading",
        level: h[1].length,
        text: h[2],
        line: blockLine,
      });
      i++;
      continue;
    }
    // Horizontal rule
    if (/^(?:-{3,}|_{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push({ kind: "hr", line: blockLine });
      i++;
      continue;
    }
    // Blockquote — collect consecutive '>' lines
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ kind: "quote", text: buf.join("\n"), line: blockLine });
      continue;
    }
    // Task list: bullet followed by [ ] / [x]. AI assistants emit these
    // constantly (TODO planning, checklists). Parsed before the plain-ul
    // path so the marker syntax doesn't leak into the rendered text.
    const TASK_RE = /^\s*[-*+]\s+\[([ xX])\]\s+/;
    if (TASK_RE.test(line)) {
      const items: string[] = [];
      const checked: boolean[] = [];
      while (i < lines.length && TASK_RE.test(lines[i])) {
        const m = lines[i].match(TASK_RE)!;
        checked.push(m[1] === "x" || m[1] === "X");
        items.push(lines[i].replace(TASK_RE, ""));
        i++;
      }
      blocks.push({ kind: "tasklist", items, checked, line: blockLine });
      continue;
    }
    // Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ul", items, line: blockLine });
      continue;
    }
    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ol", items, line: blockLine });
      continue;
    }
    // Table (GFM): a header row (`| a | b |`) immediately followed by a
    // separator row (`| --- | :--: |`). AI assistants emit these for
    // comparison / result grids; without this they fell through to a
    // paragraph and rendered as raw pipes.
    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      lines[i + 1].includes("|") &&
      /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(lines[i + 1])
    ) {
      const splitRow = (row: string): string[] =>
        row
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split(/(?<!\\)\|/)
          .map((c) => c.replace(/\\\|/g, "|").trim());
      const header = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map((c) => {
        const left = c.startsWith(":");
        const right = c.endsWith(":");
        if (left && right) return "center" as const;
        if (right) return "right" as const;
        if (left) return "left" as const;
        return null;
      });
      i += 2;
      const rows: string[][] = [];
      while (
        i < lines.length &&
        lines[i].includes("|") &&
        lines[i].trim() !== ""
      ) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({
        kind: "table",
        table: { header, rows, aligns },
        line: blockLine,
      });
      continue;
    }
    // Blank
    if (line.trim() === "") {
      blocks.push({ kind: "blank" });
      i++;
      continue;
    }
    // Paragraph — collect consecutive non-empty lines that don't start a new
    // block construct.
    const buf: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^#{1,6}\s+/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^\s*[-*+]\s+\[[ xX]\]\s+/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^(?:-{3,}|_{3,}|\*{3,})\s*$/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push({ kind: "paragraph", text: buf.join("\n"), line: blockLine });
  }
  return blocks;
}

const COPY_ICON_SVG =
  '<svg class="md-code-copy-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

function isShellLang(lang: string): boolean {
  return !lang || /^(?:bash|sh|shell|zsh|console)$/i.test(lang);
}

function highlightShellLine(text: string): string {
  const m = text.trim().match(/^(\S+)([\s\S]*)$/);
  if (!m) return escapeHtml(text);
  const cmd = `<span class="md-tok-cmd">${escapeHtml(m[1])}</span>`;
  const rest = m[2] ? `<span class="md-tok-arg">${escapeHtml(m[2])}</span>` : "";
  return cmd + rest;
}

function renderCodeBlock(b: Block): string {
  const text = b.text ?? "";
  const lang = b.lang ?? "";
  const isSingle = !text.includes("\n");
  const codeInner =
    isSingle && isShellLang(lang) ? highlightShellLine(text) : escapeHtml(text);
  const singleClass = isSingle ? " md-code-block--single" : "";
  const lineAttr = b.line ? ` data-source-line="${b.line}"` : "";
  return (
    `<div class="md-code-block${singleClass}"${lineAttr}>` +
    `<div class="md-code-pill"><pre><code class="lang-${lang}">${codeInner}</code></pre></div>` +
    `<div class="md-code-actions"><button class="md-code-copy-btn" type="button" ` +
    `aria-label="Copy" title="Copy" data-md-copy="true">${COPY_ICON_SVG}</button></div>` +
    `</div>`
  );
}

export function renderMarkdown(md: string): string {
  const blocks = tokenize(md);
  const parts: string[] = [];
  // Emit `data-source-line` on every block so the preview can map a
  // click back to a source line and the editor can highlight which
  // block the cursor is currently in. Headings get a bonus
  // `md-anchor` class to flag them as primary jump targets.
  const lineAttr = (b: Block) =>
    b.line ? ` data-source-line="${b.line}"` : "";
  for (const b of blocks) {
    switch (b.kind) {
      case "heading": {
        const lvl = b.level ?? 1;
        parts.push(
          `<h${lvl} class="md-anchor"${lineAttr(b)}>${inlineMd(b.text ?? "")}</h${lvl}>`,
        );
        break;
      }
      case "paragraph": {
        parts.push(`<p${lineAttr(b)}>${inlineMd(b.text ?? "")}</p>`);
        break;
      }
      case "code": {
        parts.push(renderCodeBlock(b));
        break;
      }
      case "ul": {
        parts.push(
          `<ul${lineAttr(b)}>${(b.items ?? [])
            .map((it) => `<li>${inlineMd(it)}</li>`)
            .join("")}</ul>`,
        );
        break;
      }
      case "ol": {
        parts.push(
          `<ol${lineAttr(b)}>${(b.items ?? [])
            .map((it) => `<li>${inlineMd(it)}</li>`)
            .join("")}</ol>`,
        );
        break;
      }
      case "tasklist": {
        const items = b.items ?? [];
        const checked = b.checked ?? [];
        parts.push(
          `<ul class="md-tasklist"${lineAttr(b)}>${items
            .map((it, idx) => {
              const isChecked = !!checked[idx];
              const box = isChecked
                ? `<input type="checkbox" checked disabled>`
                : `<input type="checkbox" disabled>`;
              return `<li class="md-task${isChecked ? " md-task-done" : ""}">${box} ${inlineMd(it)}</li>`;
            })
            .join("")}</ul>`,
        );
        break;
      }
      case "table": {
        const t = b.table;
        if (!t) break;
        const alignAttr = (idx: number) => {
          const a = t.aligns[idx] ?? null;
          return a ? ` style="text-align:${a}"` : "";
        };
        const head = t.header
          .map((c, idx) => `<th${alignAttr(idx)}>${inlineMd(c)}</th>`)
          .join("");
        const body = t.rows
          .map(
            (r) =>
              `<tr>${r
                .map((c, idx) => `<td${alignAttr(idx)}>${inlineMd(c)}</td>`)
                .join("")}</tr>`,
          )
          .join("");
        parts.push(
          `<div class="md-table-wrap"${lineAttr(b)}><table class="md-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`,
        );
        break;
      }
      case "quote": {
        const inner = renderMarkdown(b.text ?? "");
        parts.push(`<blockquote${lineAttr(b)}>${inner}</blockquote>`);
        break;
      }
      case "hr": {
        parts.push(`<hr${lineAttr(b)}>`);
        break;
      }
      case "blank":
        break;
    }
  }
  return parts.join("\n");
}
