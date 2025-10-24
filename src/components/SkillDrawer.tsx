import { useState, useEffect, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SkillInfo, SkillDetails, DirectoryEntry } from "../types";
import MarkdownText from "./MarkdownText";
import RevealInFinderButton from "./RevealInFinderButton";

interface SkillDrawerProps {
  open: boolean;
  selectedSkill: SkillInfo | null;
  workingDir: string | undefined;
  onClose: () => void;
}

// Icon components
const icons: Record<string, ReactNode> = {
  refresh: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M16 10a6 6 0 0 1-6 6 6 6 0 0 1-6-6 6 6 0 0 1 6-6V2l4 3-4 3V6a4 4 0 0 0-4 4 4 4 0 0 0 4 4 4 4 0 0 0 4-4h2 Z"
        fill="currentColor"
      />
    </svg>
  ),
  file: (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <path
        d="M5 3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5H5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 3v5h5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  folder: (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <path
        d="M3 5a2 2 0 0 1 2-2h3.5l1.5 1.5h5a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

export default function SkillDrawer({
  open,
  selectedSkill,
  workingDir,
  onClose,
}: SkillDrawerProps) {
  const [skillDetails, setSkillDetails] = useState<SkillDetails | null>(null);
  const [skillFiles, setSkillFiles] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load skill details when selected skill changes
  useEffect(() => {
    if (!selectedSkill || !open) {
      return;
    }

    const loadSkillDetails = async () => {
      setLoading(true);
      setError(null);

      try {
        // Load skill details (SKILL.md content)
        const details = await invoke<SkillDetails>("get_skill_details", {
          name: selectedSkill.name,
          workingDir: workingDir,
          scope: selectedSkill.scope,
        });
        setSkillDetails(details);

        // If this is a directory skill (has SKILL.md), load the directory contents
        if (details.file_path.endsWith("SKILL.md")) {
          const skillDir = details.file_path.replace(/\/SKILL\.md$/, "");
          const listing = await invoke<{ path: string; entries: DirectoryEntry[] }>("list_directory", {
            path: skillDir,
          });
          // Filter out SKILL.md from the list (we're already showing it)
          setSkillFiles(listing.entries.filter(f => f.name !== "SKILL.md"));
        } else {
          setSkillFiles([]);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setSkillDetails(null);
        setSkillFiles([]);
      } finally {
        setLoading(false);
      }
    };

    void loadSkillDetails();
  }, [selectedSkill, workingDir, open]);

  // Reset when drawer closes
  useEffect(() => {
    if (!open) {
      setSkillDetails(null);
      setSkillFiles([]);
      setError(null);
    }
  }, [open]);

  return (
    <div className={`quack-agency-drawer ${open ? "open" : ""}`}>
      <div className="quack-agency-drawer-backdrop" onClick={onClose} />
      <div className="quack-agency-drawer-panel">
        <header className="quack-agency-drawer-header">
          <div className="quack-agency-header-content">
            <h2>Skill Details</h2>
          </div>
          <button
            type="button"
            className="quack-agency-drawer-close"
            title="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </header>

        <div className="quack-agency-drawer-body">
          {loading && (
            <div className="quack-agency-loading">Loading skill...</div>
          )}

          {error && (
            <div className="quack-agency-error">
              <p>❌ Error loading skill:</p>
              <pre>{error}</pre>
            </div>
          )}

          {!loading && !error && skillDetails && (
            <div className="quack-agency-detail">
              {/* Skill header */}
              <div className="agent-detail-header">
                {/* Skill Icon */}
                <div
                  className="w-14 h-14 rounded-lg flex-shrink-0 flex items-center justify-center text-2xl"
                  style={{
                    background: "rgba(242, 140, 82, 0.15)",
                    border: "1px solid rgba(242, 140, 82, 0.3)",
                  }}
                >
                  ⚡
                </div>

                <div className="agent-detail-title">
                  <div className="agent-detail-title-row">
                    <h3>{skillDetails.name.replace(/-/g, " ")}</h3>
                  </div>
                  <div className="agent-detail-meta">
                    <span className="agent-detail-model">
                      {skillDetails.description}
                    </span>
                  </div>
                </div>
              </div>

              {/* Skill content (SKILL.md rendered as markdown) */}
              <div className="agent-detail-markdown-viewer">
                <MarkdownText>{skillDetails.content}</MarkdownText>
              </div>

              {/* Files in skill directory */}
              {skillFiles.length > 0 && (
                <div className="skill-files-section">
                  <h4 className="skill-files-header">
                    📂 Files in this skill ({skillFiles.length})
                  </h4>
                  <div className="skill-files-list">
                    {skillFiles.map((file) => (
                      <div
                        key={file.path}
                        className="skill-file-item"
                        title={file.path}
                      >
                        <span className="skill-file-icon">
                          {file.is_dir ? icons.folder : icons.file}
                        </span>
                        <span className="skill-file-name">{file.name}</span>
                        {!file.is_dir && (
                          <RevealInFinderButton path={file.path} iconOnly />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading && !error && !skillDetails && selectedSkill && (
            <div className="quack-agency-empty">
              <p>No skill selected</p>
            </div>
          )}
        </div>

        <footer className="quack-agency-drawer-footer">
          <div className="quack-agency-drawer-stats">
            {skillDetails ? (
              <>
                <span>{skillDetails.file_path}</span>
                <RevealInFinderButton path={skillDetails.file_path} iconOnly />
              </>
            ) : (
              <span>Select a skill to view details</span>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
