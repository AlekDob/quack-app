import type { ReactNode } from "react";
import { Icon } from "./Icon";

export type GitSectionId =
  | "conflicts"
  | "staged"
  | "changes"
  | "history"
  | "stashes";

export function pickDefaultGitSection(
  conflicts: number,
  staged: number,
  changes: number,
): GitSectionId {
  if (conflicts > 0) return "conflicts";
  if (changes > 0) return "changes";
  if (staged > 0) return "staged";
  return "changes";
}

interface SectionProps {
  id: GitSectionId;
  openId: GitSectionId | null;
  onToggle: (id: GitSectionId) => void;
  title: string;
  count?: number;
  hint?: string;
  trailing?: ReactNode;
  children: ReactNode;
}

export function GitAccordionSection({
  id,
  openId,
  onToggle,
  title,
  count,
  hint,
  trailing,
  children,
}: SectionProps) {
  const isOpen = openId === id;
  return (
    <div className={`git-accordion-section ${isOpen ? "is-open" : ""}`}>
      <button
        type="button"
        className="git-section-toggle"
        onClick={() => onToggle(id)}
        aria-expanded={isOpen}
      >
        <Icon name={isOpen ? "chevron-down" : "chevron-right"} size={11} />
        <span className="git-section-toggle-label">{title}</span>
        {count !== undefined && (
          <span className="git-section-count">({count})</span>
        )}
        {isOpen && hint && (
          <span className="git-section-hint">{hint}</span>
        )}
        {trailing}
      </button>
      {isOpen && <div className="git-section-scroll">{children}</div>}
    </div>
  );
}
