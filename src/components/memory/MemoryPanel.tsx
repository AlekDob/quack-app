import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Code2, ExternalLink, Edit3, Brain } from "lucide-react";
import { toast } from "sonner";
import type { BrainSettings } from "../../types/brainSync";
import type { BrainEntity } from "../../types/brain";
import { useIDEStore } from "../../stores/ideStore";
import { BRAIN_UPDATED_EVENT } from "../../services/brainService";

/**
 * Memory Panel - Minimal Vault Path Display
 *
 * Shows vault location with quick actions to open it in different apps.
 * Replaces the previous complex memory list with a simple vault management UI.
 */

interface MemoryPanelProps {
  /** Optional session ID */
  sessionId?: string;
  /** Optional project path */
  projectPath?: string;
}

// Animated Brain SVG that grows based on entity count
function AnimatedBrain({ entityCount, maxCount = 500 }: { entityCount: number; maxCount?: number }) {
  // Calculate scale based on count (min 0.6, max 1.2)
  const scale = useMemo(() => {
    const ratio = Math.min(entityCount / maxCount, 1);
    return 0.6 + (ratio * 0.6);
  }, [entityCount, maxCount]);

  // Calculate glow intensity based on count
  const glowIntensity = useMemo(() => {
    const ratio = Math.min(entityCount / maxCount, 1);
    return 0.3 + (ratio * 0.7);
  }, [entityCount, maxCount]);

  // Pulse speed - faster when more entities
  const pulseSpeed = useMemo(() => {
    const ratio = Math.min(entityCount / maxCount, 1);
    return 3 - (ratio * 1.5); // 3s to 1.5s
  }, [entityCount, maxCount]);

  // Color gradient based on count
  const brainColor = useMemo(() => {
    const ratio = Math.min(entityCount / maxCount, 1);
    // From pink (#E84A7F) to electric purple (#9333EA) to cyan (#06B6D4)
    if (ratio < 0.5) {
      return "#E84A7F";
    } else if (ratio < 0.8) {
      return "#9333EA";
    } else {
      return "#06B6D4";
    }
  }, [entityCount, maxCount]);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        width: 120,
        height: 120,
      }}
    >
      {/* Outer glow rings */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${brainColor}${Math.round(glowIntensity * 40).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
          animation: `pulse ${pulseSpeed}s ease-in-out infinite`,
          transform: `scale(${scale * 1.5})`,
        }}
      />
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${brainColor}${Math.round(glowIntensity * 25).toString(16).padStart(2, '0')} 0%, transparent 60%)`,
          animation: `pulse ${pulseSpeed * 1.3}s ease-in-out infinite`,
          animationDelay: '0.5s',
          transform: `scale(${scale * 1.3})`,
        }}
      />

      {/* Brain SVG */}
      <svg
        viewBox="0 0 64 64"
        style={{
          width: 64 * scale,
          height: 64 * scale,
          filter: `drop-shadow(0 0 ${8 * glowIntensity}px ${brainColor}) drop-shadow(0 0 ${16 * glowIntensity}px ${brainColor}40)`,
          transition: 'all 0.5s ease-out',
        }}
      >
        {/* Brain outline with neural pathways */}
        <defs>
          <linearGradient id="brainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={brainColor} />
            <stop offset="50%" stopColor={brainColor} stopOpacity="0.8" />
            <stop offset="100%" stopColor="#E84A7F" />
          </linearGradient>
          <filter id="brainGlow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Left hemisphere */}
        <path
          d="M32 8c-8 0-14 4-17 10-2 4-2 9 0 14 1 3 0 6-2 8-3 4-3 9 0 13 2 3 6 5 10 5 3 0 6-1 9-3"
          fill="none"
          stroke="url(#brainGradient)"
          strokeWidth="2"
          strokeLinecap="round"
          filter="url(#brainGlow)"
          style={{
            animation: `brainPulse ${pulseSpeed}s ease-in-out infinite`,
          }}
        />

        {/* Right hemisphere */}
        <path
          d="M32 8c8 0 14 4 17 10 2 4 2 9 0 14-1 3 0 6 2 8 3 4 3 9 0 13-2 3-6 5-10 5-3 0-6-1-9-3"
          fill="none"
          stroke="url(#brainGradient)"
          strokeWidth="2"
          strokeLinecap="round"
          filter="url(#brainGlow)"
          style={{
            animation: `brainPulse ${pulseSpeed}s ease-in-out infinite`,
            animationDelay: '0.2s',
          }}
        />

        {/* Neural connections - left */}
        <path
          d="M18 22c4 2 6 6 6 10M14 32c5-1 9 2 11 6M20 44c3-3 7-3 10-1"
          fill="none"
          stroke={brainColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity={0.6 + glowIntensity * 0.4}
          style={{
            animation: `neuralFlash ${pulseSpeed * 0.7}s ease-in-out infinite`,
          }}
        />

        {/* Neural connections - right */}
        <path
          d="M46 22c-4 2-6 6-6 10M50 32c-5-1-9 2-11 6M44 44c-3-3-7-3-10-1"
          fill="none"
          stroke={brainColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity={0.6 + glowIntensity * 0.4}
          style={{
            animation: `neuralFlash ${pulseSpeed * 0.7}s ease-in-out infinite`,
            animationDelay: '0.3s',
          }}
        />

        {/* Center connection */}
        <path
          d="M32 15v35"
          fill="none"
          stroke={brainColor}
          strokeWidth="1"
          strokeLinecap="round"
          strokeDasharray="3 3"
          opacity={0.4 + glowIntensity * 0.3}
        />

        {/* Synaptic nodes */}
        {[
          { cx: 20, cy: 20 }, { cx: 44, cy: 20 },
          { cx: 16, cy: 32 }, { cx: 48, cy: 32 },
          { cx: 22, cy: 44 }, { cx: 42, cy: 44 },
          { cx: 32, cy: 28 }, { cx: 32, cy: 40 },
        ].map((node, i) => (
          <circle
            key={i}
            cx={node.cx}
            cy={node.cy}
            r={1.5 + glowIntensity}
            fill={brainColor}
            opacity={0.5 + glowIntensity * 0.5}
            style={{
              animation: `nodePulse ${pulseSpeed * 0.5}s ease-in-out infinite`,
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </svg>

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes brainPulse {
          0%, 100% { stroke-width: 2; }
          50% { stroke-width: 2.5; }
        }
        @keyframes neuralFlash {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes nodePulse {
          0%, 100% { r: 1.5; opacity: 0.5; }
          50% { r: 2.5; opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default function MemoryPanel({
  sessionId,
  projectPath,
}: MemoryPanelProps) {
  const [vaultPath, setVaultPath] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [entityCount, setEntityCount] = useState(0);
  const { openProjectInIDE, preferredIDE } = useIDEStore();

  // Load vault path and entity count on mount
  useEffect(() => {
    loadVaultPath();
    loadEntityCount();
  }, []);

  // Listen for brain updates
  useEffect(() => {
    const handleBrainUpdate = () => {
      loadEntityCount();
    };
    window.addEventListener(BRAIN_UPDATED_EVENT, handleBrainUpdate);
    return () => window.removeEventListener(BRAIN_UPDATED_EVENT, handleBrainUpdate);
  }, []);

  const loadEntityCount = async () => {
    try {
      const entities = await invoke<BrainEntity[]>("brain_list_entities", { filters: {} });
      setEntityCount(entities.length);
    } catch (err) {
      console.error("[MemoryPanel] Failed to load entity count:", err);
    }
  };

  const loadVaultPath = async () => {
    setLoading(true);
    try {
      const settings = await invoke<BrainSettings>("brain_get_settings");
      setVaultPath(settings.vaultPath || "");
    } catch (err) {
      console.error("[MemoryPanel] Failed to load vault path:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePath = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select Obsidian Vault Folder",
      });

      if (selected && typeof selected === "string") {
        await invoke("brain_set_setting", {
          key: "vault_path",
          value: selected,
        });
        setVaultPath(selected);
        toast.success("Vault path updated");
      }
    } catch (err) {
      console.error("[MemoryPanel] Failed to change vault path:", err);
      toast.error("Failed to change vault path");
    }
  };

  const handleOpenFinder = async () => {
    if (!vaultPath) {
      toast.error("No vault path configured");
      return;
    }

    try {
      await invoke("reveal_in_finder", { path: vaultPath });
    } catch (err) {
      console.error("[MemoryPanel] Failed to open in Finder:", err);
      toast.error("Failed to open Finder");
    }
  };

  const handleOpenIDE = async () => {
    if (!vaultPath) {
      toast.error("No vault path configured");
      return;
    }

    if (!preferredIDE) {
      toast.error("No IDE configured. Set one in Settings.");
      return;
    }

    try {
      // Use Rust command to open folder in IDE (more reliable than CLI)
      await invoke("open_folder_in_ide", { ideId: preferredIDE, folderPath: vaultPath });
      toast.success("Opening in IDE");
    } catch (err) {
      console.error("[MemoryPanel] Failed to open in IDE:", err);
      toast.error(`Failed to open in IDE: ${err}`);
    }
  };

  const handleOpenObsidian = async () => {
    if (!vaultPath) {
      toast.error("No vault path configured");
      return;
    }

    try {
      // The vault path points to parent folder, QuackBrain subfolder is the actual vault
      // Use vault name "QuackBrain" which is consistent across all setups
      const obsidianUri = `obsidian://open?vault=QuackBrain`;
      await invoke("open_external_url", { url: obsidianUri });
      toast.success("Opening in Obsidian");
    } catch (err) {
      console.error("[MemoryPanel] Failed to open in Obsidian:", err);
      toast.error("Failed to open Obsidian. Make sure Obsidian is installed and QuackBrain vault exists.");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Brain size={16} style={{ color: "#E84A7F" }} />
          <h3 className="text-sm font-semibold text-white">Quack Brain</h3>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 text-sm text-white/60">
            <Brain
              size={24}
              className="animate-spin mb-2"
              style={{ color: "#E84A7F" }}
            />
            <span>Loading...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Animated Brain Visualization */}
            <div className="flex flex-col items-center py-2">
              <AnimatedBrain entityCount={entityCount} />

              {/* Entity Counter */}
              <div className="mt-3 text-center">
                <div
                  className="text-3xl font-bold tabular-nums"
                  style={{
                    background: entityCount > 250
                      ? "linear-gradient(135deg, #06B6D4 0%, #9333EA 100%)"
                      : entityCount > 100
                      ? "linear-gradient(135deg, #9333EA 0%, #E84A7F 100%)"
                      : "linear-gradient(135deg, #E84A7F 0%, #F472B6 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {entityCount.toLocaleString()}
                </div>
                <div className="text-xs text-white/40 mt-0.5 uppercase tracking-widest">
                  memories
                </div>
              </div>
            </div>

            {/* Vault Path Section */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-white/40 uppercase tracking-wide">
                Vault
              </label>
              {vaultPath ? (
                <div
                  className="p-2.5 rounded-lg bg-black/20 border border-white/5"
                  title={vaultPath}
                >
                  <span className="text-[10px] font-mono break-all text-white/50">
                    {vaultPath.length > 40 ? `...${vaultPath.slice(-37)}` : vaultPath}
                  </span>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-black/20 border border-dashed border-white/10">
                  <span className="text-[10px] text-white/30 italic">
                    No vault configured
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons - Compact Grid */}
            <div className="grid grid-cols-4 gap-1.5">
              {/* Change */}
              <button
                type="button"
                onClick={handleChangePath}
                className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg text-[10px] font-medium transition-all hover:scale-105"
                style={{
                  background: "rgba(232, 74, 127, 0.1)",
                  border: "1px solid rgba(232, 74, 127, 0.2)",
                  color: "#E84A7F",
                }}
                title="Change vault path"
              >
                <Edit3 size={14} />
                <span>Change</span>
              </button>

              {/* Open in Finder */}
              <button
                type="button"
                onClick={handleOpenFinder}
                disabled={!vaultPath}
                className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg text-[10px] font-medium transition-all bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
                title="Open in Finder"
              >
                <FolderOpen size={14} />
                <span>Finder</span>
              </button>

              {/* Open in IDE */}
              <button
                type="button"
                onClick={handleOpenIDE}
                disabled={!vaultPath}
                className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg text-[10px] font-medium transition-all bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
                title="Open in IDE"
              >
                <Code2 size={14} />
                <span>IDE</span>
              </button>

              {/* Open in Obsidian */}
              <button
                type="button"
                onClick={handleOpenObsidian}
                disabled={!vaultPath}
                className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg text-[10px] font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 hover:scale-105"
                style={{
                  background: "rgba(139, 92, 246, 0.1)",
                  border: "1px solid rgba(139, 92, 246, 0.2)",
                  color: "#a78bfa",
                }}
                title="Open in Obsidian"
              >
                <ExternalLink size={14} />
                <span>Obsidian</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
