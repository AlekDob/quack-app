/** Prepare feature-doc markdown for the preview drawer (hero already shows the title). */

function stripFrontmatter(src: string): string {
  if (!src.startsWith("---")) return src;
  const end = src.indexOf("\n---", 3);
  if (end === -1) return src;
  return src.slice(end + 4).replace(/^\s*\n/, "");
}

function normalizeHeading(s: string): string {
  return s
    .replace(/^[#]+\s*/, "")
    .replace(/^\d{3}\s*[—·\-]\s*/, "")
    .trim()
    .toLowerCase();
}

function stripFirstHeading(src: string, title?: string): string {
  const lines = src.split("\n");
  let i = 0;
  while (i < lines.length && lines[i]?.trim() === "") i += 1;
  if (i >= lines.length) return src;
  const line = lines[i]!.trim();
  if (!/^#{1,3}\s+/.test(line)) return src;
  if (title) {
    const heading = line.replace(/^#{1,3}\s+/, "").trim();
    if (normalizeHeading(heading) !== normalizeHeading(title)) return src;
  }
  lines.splice(i, 1);
  while (i < lines.length && lines[i]?.trim() === "") lines.splice(i, 1);
  return lines.join("\n");
}

/** Title for the drawer hero — drop numeric prefix when the badge shows it. */
export function featureDisplayTitle(
  title: string,
  featureNum?: number,
): string {
  if (featureNum == null) return title;
  const num = String(featureNum).padStart(3, "0");
  const stripped = title
    .replace(new RegExp(`^${num}\\s*[—·\\-]\\s*`, "i"), "")
    .trim();
  return stripped || title;
}

/** Filename label without repeating the numeric prefix. */
export function featureFileLabel(
  featurePath: string,
  featureNum?: number,
): string {
  const file = featurePath.split("/").pop() ?? featurePath;
  if (featureNum == null) return file;
  const prefix = `${String(featureNum).padStart(3, "0")}-`;
  return file.startsWith(prefix) ? file.slice(prefix.length) : file;
}

export function featureDocPreviewBody(src: string, title?: string): string {
  return stripFirstHeading(stripFrontmatter(src), title).trimStart();
}
