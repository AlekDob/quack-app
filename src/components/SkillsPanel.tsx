import { useState } from 'react';
import type { SkillInfo } from "../types";

/**
 * Skills Panel - List view of skills from .claude/skills
 * Similar to AgentsPanel but simpler (no creation modal, no "Use" button, just view/select)
 */

interface SkillsPanelProps {
  skills: SkillInfo[];
  loading: boolean;
  error: string | null;
  directoryExists: boolean;
  onSelectSkill: (skill: SkillInfo) => void;
  onRefresh: () => void;
}

export default function SkillsPanel({
  skills,
  loading,
  error,
  directoryExists,
  onSelectSkill,
  onRefresh,
}: SkillsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [globalExpanded, setGlobalExpanded] = useState(true);
  const [projectExpanded, setProjectExpanded] = useState(true);

  // Filter skills based on search query
  const filteredSkills = skills.filter(skill =>
    skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    skill.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="agents-panel">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{
          borderColor: "rgba(255, 255, 255, 0.1)",
        }}
      >
        <h3 className="text-sm font-semibold" style={{ color: "#f28c52" }}>
          Skills
        </h3>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="px-3 py-1.5 rounded text-xs font-medium transition-all duration-200 disabled:opacity-50"
          style={{
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            color: "rgba(255, 255, 255, 0.9)",
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
          }}
        >
          {loading ? "..." : "↻ Refresh"}
        </button>
      </div>

      {/* Search */}
      {skills.length > 0 && (
        <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255, 255, 255, 0.1)" }}>
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search skills..."
              className="w-full px-3 py-2 pl-8 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
            />
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div
            className="flex items-center justify-center py-8 text-sm"
            style={{ color: "rgba(255, 255, 255, 0.6)" }}
          >
            Loading skills...
          </div>
        )}

        {error && (
          <div className="p-4">
            <div
              className="p-3 rounded-lg text-sm"
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#EF4444",
              }}
            >
              <p className="font-medium mb-1">Error loading skills</p>
              <p className="text-xs opacity-80">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && skills.length === 0 && !directoryExists && (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="text-5xl mb-4">⚡</div>
            <h4
              className="text-base font-semibold mb-2"
              style={{ color: "#f28c52" }}
            >
              No Skills Directory
            </h4>
            <p
              className="text-sm mb-6 max-w-xs"
              style={{ color: "rgba(255, 255, 255, 0.6)" }}
            >
              Create a <code className="px-1 py-0.5 rounded text-xs font-mono" style={{ background: "rgba(242, 140, 82, 0.1)", color: "#f28c52" }}>.claude/skills/</code> directory to add custom skills.
            </p>
          </div>
        )}

        {!loading && !error && skills.length === 0 && directoryExists && (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="text-5xl mb-4">📂</div>
            <h4
              className="text-base font-semibold mb-2"
              style={{ color: "rgba(255, 255, 255, 0.7)" }}
            >
              No skills found
            </h4>
            <p
              className="text-sm"
              style={{ color: "rgba(255, 255, 255, 0.5)" }}
            >
              Add skill files to{" "}
              <code
                className="px-1.5 py-0.5 rounded text-xs font-mono"
                style={{
                  background: "rgba(242, 140, 82, 0.1)",
                  color: "#f28c52",
                }}
              >
                .claude/skills/
              </code>
            </p>
          </div>
        )}

        {!loading && !error && skills.length > 0 && filteredSkills.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="text-5xl mb-4">🔍</div>
            <h4
              className="text-base font-semibold mb-2"
              style={{ color: "rgba(255, 255, 255, 0.7)" }}
            >
              No skills match your search
            </h4>
            <p
              className="text-sm"
              style={{ color: "rgba(255, 255, 255, 0.5)" }}
            >
              Try a different search term
            </p>
          </div>
        )}

        {!loading && !error && filteredSkills.length > 0 && (
          <div className="p-3 space-y-4">
            {/* Global Skills Section */}
            {filteredSkills.filter((s) => s.scope === "global").length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setGlobalExpanded(!globalExpanded)}
                  className="w-full px-3 py-2 flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  <span className={`transition-transform ${globalExpanded ? 'rotate-90' : ''}`}>▶</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" strokeWidth={2} />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 12h20" />
                  </svg>
                  <span>Global Skills</span>
                  <span className="ml-auto text-xs text-white/40">{filteredSkills.filter((s) => s.scope === "global").length}</span>
                </button>
                {globalExpanded && (
                <div className="space-y-2">
                  {filteredSkills
                    .filter((s) => s.scope === "global")
                    .map((skill) => (
                      <div
                        key={skill.name}
                        className="rounded-lg border transition-all duration-200 cursor-pointer"
                        style={{
                          background: "rgba(12, 16, 24, 0.6)",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                        }}
                        onClick={() => onSelectSkill(skill)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(242, 140, 82, 0.08)";
                          e.currentTarget.style.borderColor = "rgba(242, 140, 82, 0.2)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "rgba(12, 16, 24, 0.6)";
                          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                        }}
                      >
                        {/* Skill card */}
                        <div className="w-full flex items-start gap-3 p-3 transition-all duration-200">
                          {/* Skill Icon */}
                          <div
                            className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-lg"
                            style={{
                              background: "rgba(242, 140, 82, 0.15)",
                              border: "1px solid rgba(242, 140, 82, 0.3)",
                            }}
                          >
                            ⚡
                          </div>

                          {/* Skill Info */}
                          <div className="flex-1 min-w-0 flex flex-col gap-1">
                            {/* Skill Name */}
                            <div
                              className="text-sm font-medium text-left"
                              style={{ color: "rgba(255, 255, 255, 0.9)" }}
                            >
                              {skill.name.replace(/-/g, " ")}
                            </div>

                            {/* Description */}
                            <div
                              className="text-xs truncate"
                              style={{ color: "rgba(255, 255, 255, 0.5)" }}
                            >
                              {skill.description.substring(0, 60)}
                              {skill.description.length > 60 ? "..." : ""}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
                )}
              </div>
            )}

            {/* Project Skills Section */}
            {filteredSkills.filter((s) => s.scope === "project").length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setProjectExpanded(!projectExpanded)}
                  className="w-full px-3 py-2 flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  <span className={`transition-transform ${projectExpanded ? 'rotate-90' : ''}`}>▶</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span>Project Skills</span>
                  <span className="ml-auto text-xs text-white/40">{filteredSkills.filter((s) => s.scope === "project").length}</span>
                </button>
                {projectExpanded && (
                <div className="space-y-2">
                  {filteredSkills
                    .filter((s) => s.scope === "project")
                    .map((skill) => (
                      <div
                        key={skill.name}
                        className="rounded-lg border transition-all duration-200 cursor-pointer"
                        style={{
                          background: "rgba(12, 16, 24, 0.6)",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                        }}
                        onClick={() => onSelectSkill(skill)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(242, 140, 82, 0.08)";
                          e.currentTarget.style.borderColor = "rgba(242, 140, 82, 0.2)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "rgba(12, 16, 24, 0.6)";
                          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                        }}
                      >
                        {/* Skill card */}
                        <div className="w-full flex items-start gap-3 p-3 transition-all duration-200">
                          {/* Skill Icon */}
                          <div
                            className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-lg"
                            style={{
                              background: "rgba(242, 140, 82, 0.15)",
                              border: "1px solid rgba(242, 140, 82, 0.3)",
                            }}
                          >
                            ⚡
                          </div>

                          {/* Skill Info */}
                          <div className="flex-1 min-w-0 flex flex-col gap-1">
                            {/* Skill Name */}
                            <div
                              className="text-sm font-medium text-left"
                              style={{ color: "rgba(255, 255, 255, 0.9)" }}
                            >
                              {skill.name.replace(/-/g, " ")}
                            </div>

                            {/* Description */}
                            <div
                              className="text-xs truncate"
                              style={{ color: "rgba(255, 255, 255, 0.5)" }}
                            >
                              {skill.description.substring(0, 60)}
                              {skill.description.length > 60 ? "..." : ""}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {skills.length > 0 && (
        <div
          className="px-4 py-2.5 border-t text-xs text-center"
          style={{
            borderColor: "rgba(255, 255, 255, 0.1)",
            color: "rgba(255, 255, 255, 0.5)",
          }}
        >
          {searchQuery.trim() ? (
            <>
              {filteredSkills.length} of {skills.length} {skills.length === 1 ? "skill" : "skills"}
            </>
          ) : (
            <>
              {skills.length} {skills.length === 1 ? "skill" : "skills"} available
            </>
          )}
        </div>
      )}
    </div>
  );
}
