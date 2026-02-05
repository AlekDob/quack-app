import { useState, useEffect, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SkillInfo, SkillDetails, DirectoryEntry } from "../types";
import MarkdownText from "./MarkdownText";
import RevealInFinderButton from "./RevealInFinderButton";
import "./SkillViewer.css";

interface SkillViewerProps {
  skillName: string;
  skillScope: 'global' | 'project';
  workingDir?: string;
  onRefresh?: () => void;
}

// Icon components
const icons: Record<string, ReactNode> = {
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
  // Star icon for Skills - matching AddonsDrawer
  skill: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
};

export default function SkillViewer({
  skillName,
  skillScope,
  workingDir,
  onRefresh,
}: SkillViewerProps) {
  const [skillDetails, setSkillDetails] = useState<SkillDetails | null>(null);
  const [skillFiles, setSkillFiles] = useState<DirectoryEntry[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [dirContents, setDirContents] = useState<Map<string, DirectoryEntry[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load skill details
  useEffect(() => {
    const loadSkillDetails = async () => {
      setLoading(true);
      setError(null);

      try {
        // Load skill details (SKILL.md content)
        const details = await invoke<SkillDetails>("get_skill_details", {
          name: skillName,
          workingDir: workingDir,
          scope: skillScope,
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
  }, [skillName, skillScope, workingDir]);

  // Toggle directory expansion
  const handleToggleDir = async (dirPath: string) => {
    const newExpandedDirs = new Set(expandedDirs);

    if (expandedDirs.has(dirPath)) {
      // Collapse directory
      newExpandedDirs.delete(dirPath);
      setExpandedDirs(newExpandedDirs);
    } else {
      // Expand directory - load its contents if not already loaded
      newExpandedDirs.add(dirPath);
      setExpandedDirs(newExpandedDirs);

      if (!dirContents.has(dirPath)) {
        try {
          const listing = await invoke<{ path: string; entries: DirectoryEntry[] }>("list_directory", {
            path: dirPath,
          });
          const newDirContents = new Map(dirContents);
          newDirContents.set(dirPath, listing.entries);
          setDirContents(newDirContents);
        } catch (err) {
          console.error(`Failed to load directory ${dirPath}:`, err);
        }
      }
    }
  };

  return (
    <div className="skill-viewer">
      {loading && (
        <div className="skill-viewer-loading">
          Loading skill...
        </div>
      )}

      {error && (
        <div className="skill-viewer-error">
          <p>Error loading skill:</p>
          <pre>{error}</pre>
        </div>
      )}

      {!loading && !error && skillDetails && (
        <>
          {/* Header Section - Compact like other viewers */}
          <div className="skill-viewer-header">
            {/* Skill Icon - Solid gradient background with white icon */}
            <div className="skill-viewer-icon">
              {icons.skill}
            </div>

            <div className="skill-viewer-info">
              <h3 className="skill-viewer-title">
                {skillDetails.name.replace(/-/g, " ")}
              </h3>
              <div className="skill-viewer-meta">
                <span className="skill-viewer-scope">
                  {skillScope}
                </span>
                <span>{skillDetails.description}</span>
              </div>
            </div>

            <div className="skill-viewer-actions">
              <RevealInFinderButton path={skillDetails.file_path} iconOnly />
            </div>
          </div>

          {/* Content Section */}
          <div className="skill-viewer-content">
            <div className="skill-viewer-content-inner">
              {/* Skill content (SKILL.md rendered as markdown) */}
              <div className="skill-viewer-markdown">
                <MarkdownText>{skillDetails.content}</MarkdownText>
              </div>

              {/* Files in skill directory */}
              {skillFiles.length > 0 && (
                <div className="skill-viewer-files">
                  <h4 className="skill-viewer-files-title">
                    Files in this skill ({skillFiles.length})
                  </h4>
                  <div className="skill-viewer-files-list">
                    {skillFiles.map((file) => (
                      <div key={file.path}>
                        <div
                          className={`skill-viewer-file-item ${file.is_dir ? 'is-dir' : ''}`}
                          title={file.path}
                          onClick={() => file.is_dir && handleToggleDir(file.path)}
                        >
                          {file.is_dir && (
                            <span className={`skill-viewer-file-chevron ${expandedDirs.has(file.path) ? 'expanded' : ''}`}>
                              ▶
                            </span>
                          )}
                          <span className="skill-viewer-file-icon">
                            {file.is_dir ? icons.folder : icons.file}
                          </span>
                          <span className="skill-viewer-file-name">
                            {file.name}
                          </span>
                          {!file.is_dir && (
                            <RevealInFinderButton path={file.path} iconOnly />
                          )}
                        </div>

                        {/* Nested files when directory is expanded */}
                        {file.is_dir && expandedDirs.has(file.path) && dirContents.has(file.path) && (
                          <div className="skill-viewer-nested-files">
                            {dirContents.get(file.path)?.map((nestedFile) => (
                              <div
                                key={nestedFile.path}
                                className="skill-viewer-file-item"
                                title={nestedFile.path}
                              >
                                <span className="skill-viewer-file-icon">
                                  {nestedFile.is_dir ? icons.folder : icons.file}
                                </span>
                                <span className="skill-viewer-file-name">
                                  {nestedFile.name}
                                </span>
                                {!nestedFile.is_dir && (
                                  <RevealInFinderButton path={nestedFile.path} iconOnly />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer with file path */}
          <div className="skill-viewer-footer">
            <span className="skill-viewer-path">{skillDetails.file_path}</span>
            <RevealInFinderButton path={skillDetails.file_path} iconOnly />
          </div>
        </>
      )}
    </div>
  );
}
