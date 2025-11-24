import { useState, useEffect, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SkillInfo, SkillDetails, DirectoryEntry } from "../types";
import MarkdownText from "./MarkdownText";
import RevealInFinderButton from "./RevealInFinderButton";

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
    <div style={{
      flex: 1,
      overflow: 'auto',
      padding: '1.5rem',
      backgroundColor: 'rgba(12, 16, 24, 0.6)',
      minHeight: 0,
    }}>
      {loading && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          color: 'rgba(255, 255, 255, 0.6)',
        }}>
          Loading skill...
        </div>
      )}

      {error && (
        <div style={{
          padding: '1.5rem',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          color: '#EF4444',
        }}>
          <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>❌ Error loading skill:</p>
          <pre style={{ margin: 0, fontSize: '0.875rem' }}>{error}</pre>
        </div>
      )}

      {!loading && !error && skillDetails && (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          {/* Skill header */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            marginBottom: '2rem',
            padding: '1.5rem',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}>
            {/* Skill Icon */}
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '8px',
              flexShrink: 0,
              overflow: 'hidden',
              background: 'rgba(242, 140, 82, 0.15)',
              border: '1px solid rgba(242, 140, 82, 0.3)',
            }}>
              <img
                src="/images/skills.jpeg"
                alt="Skill"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </div>

            <div style={{ flex: 1 }}>
              <h3 style={{
                margin: '0 0 0.5rem 0',
                fontSize: '1.5rem',
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.9)',
              }}>
                {skillDetails.name.replace(/-/g, " ")}
              </h3>
              <div style={{
                fontSize: '0.875rem',
                color: 'rgba(255, 255, 255, 0.6)',
              }}>
                {skillDetails.description}
              </div>
            </div>
          </div>

          {/* Skill content (SKILL.md rendered as markdown) */}
          <div style={{
            padding: '1.5rem',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: '1.5rem',
          }}>
            <MarkdownText>{skillDetails.content}</MarkdownText>
          </div>

          {/* Files in skill directory */}
          {skillFiles.length > 0 && (
            <div style={{
              padding: '1.5rem',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}>
              <h4 style={{
                margin: '0 0 1rem 0',
                fontSize: '1rem',
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.9)',
              }}>
                📂 Files in this skill ({skillFiles.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {skillFiles.map((file) => (
                  <div key={file.path}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem',
                        borderRadius: '4px',
                        cursor: file.is_dir ? 'pointer' : 'default',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        if (file.is_dir) {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (file.is_dir) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                      title={file.path}
                      onClick={() => file.is_dir && handleToggleDir(file.path)}
                    >
                      {file.is_dir && (
                        <span style={{
                          fontSize: '0.75rem',
                          color: 'rgba(255, 255, 255, 0.5)',
                          transition: 'transform 0.15s',
                          transform: expandedDirs.has(file.path) ? 'rotate(90deg)' : 'none',
                        }}>
                          ▶
                        </span>
                      )}
                      <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        {file.is_dir ? icons.folder : icons.file}
                      </span>
                      <span style={{
                        flex: 1,
                        fontSize: '0.875rem',
                        color: 'rgba(255, 255, 255, 0.8)',
                      }}>
                        {file.name}
                      </span>
                      {!file.is_dir && (
                        <RevealInFinderButton path={file.path} iconOnly />
                      )}
                    </div>

                    {/* Nested files when directory is expanded */}
                    {file.is_dir && expandedDirs.has(file.path) && dirContents.has(file.path) && (
                      <div style={{ paddingLeft: '2rem' }}>
                        {dirContents.get(file.path)?.map((nestedFile) => (
                          <div
                            key={nestedFile.path}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              padding: '0.5rem',
                              borderRadius: '4px',
                            }}
                            title={nestedFile.path}
                          >
                            <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                              {nestedFile.is_dir ? icons.folder : icons.file}
                            </span>
                            <span style={{
                              flex: 1,
                              fontSize: '0.875rem',
                              color: 'rgba(255, 255, 255, 0.8)',
                            }}>
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

          {/* Footer with file path */}
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            fontSize: '0.75rem',
            color: 'rgba(255, 255, 255, 0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <span>{skillDetails.file_path}</span>
            <RevealInFinderButton path={skillDetails.file_path} iconOnly />
          </div>
        </div>
      )}
    </div>
  );
}
