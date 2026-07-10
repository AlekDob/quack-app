// Case-insensitive query highlighting for Brain search rows.

import type { ReactNode } from "react";
import { createElement, Fragment } from "react";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function queryTerms(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/** Split text and wrap query term hits in <mark class="brain-hit-mark">. */
export function highlightBrainText(text: string, query: string): ReactNode {
  const terms = queryTerms(query);
  if (!terms.length || !text) return text;

  const re = new RegExp(`(${terms.map(escapeRegex).join("|")})`, "gi");
  const parts = text.split(re);
  const lowerTerms = terms.map((t) => t.toLowerCase());

  return createElement(
    Fragment,
    null,
    ...parts.map((part, i) => {
      if (!part) return null;
      const hit = lowerTerms.includes(part.toLowerCase());
      return hit
        ? createElement("span", { key: i, className: "brain-hit-mark" }, part)
        : part;
    }),
  );
}
