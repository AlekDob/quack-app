import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import type { NativeTerminalApp } from "../types";

interface AddNativeTerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string, directory: string, color: string, app: NativeTerminalApp) => void;
  defaultDirectory?: string;
}

const AVAILABLE_APPS: Array<{ id: NativeTerminalApp; label: string }> = [
  { id: "Terminal", label: "Terminal.app" },
  { id: "iTerm", label: "iTerm2" },
  { id: "Warp", label: "Warp" },
  { id: "WezTerm", label: "WezTerm" },
  { id: "Hyper", label: "Hyper" },
  { id: "Alacritty", label: "Alacritty" },
];

const PRESET_COLORS = [
  "#4ecdc4",
  "#ff6b6b",
  "#95e1d3",
  "#f38181",
  "#aa96da",
  "#fcbad3",
  "#ffffd2",
  "#a8d8ea",
  "#ffb5e8",
  "#c7ceea",
  "#ffd3b6",
  "#d4a5a5",
];

export function AddNativeTerminalModal({
  isOpen,
  onClose,
  onConfirm,
  defaultDirectory,
}: AddNativeTerminalModalProps) {
  const [name, setName] = useState("");
  const [directory, setDirectory] = useState(defaultDirectory || "");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [customColor, setCustomColor] = useState("");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedApp, setSelectedApp] = useState<NativeTerminalApp>("Terminal");

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName("");
      setDirectory(defaultDirectory || "");
      setColor(PRESET_COLORS[0]);
      setCustomColor("");
      setShowColorPicker(false);
      setSelectedApp("Terminal");
    }
  }, [isOpen, defaultDirectory]);

  const handleSelectDirectory = useCallback(async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        defaultPath: directory || undefined,
      });

      if (selected) {
        setDirectory(selected);
      }
    } catch (error) {
      console.error("Failed to select directory:", error);
    }
  }, [directory]);

  const handleLoadHomeDirectory = useCallback(async () => {
    try {
      const homeDir = await invoke<string>("get_home_directory");
      setDirectory(homeDir);
    } catch (error) {
      console.error("Failed to get home directory:", error);
    }
  }, []);

  const handleConfirm = useCallback(() => {
    const trimmedName = name.trim();
    const trimmedPath = directory.trim();

    if (!trimmedName) {
      return;
    }

    const finalColor = showColorPicker && customColor ? customColor : color;
    onConfirm(trimmedName, trimmedPath, finalColor, selectedApp);
    onClose();
  }, [name, directory, color, customColor, showColorPicker, selectedApp, onConfirm, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && name.trim()) {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [name, handleConfirm, onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#1e1e1e] rounded-2xl p-6 w-[480px] shadow-2xl border border-white/10"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <h2 className="text-lg font-semibold text-white/90 mb-4">Add Native Terminal</h2>

        {/* Name Input */}
        <div className="mb-4">
          <label className="block text-sm text-white/70 mb-2">Terminal Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Quack App, Backend Server"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-[#0e639c]"
            autoFocus
          />
        </div>

        {/* Directory Input */}
        <div className="mb-4">
          <label className="block text-sm text-white/70 mb-2">Working Directory</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={directory}
              onChange={(e) => setDirectory(e.target.value)}
              placeholder="~/Projects/my-app"
              className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-[#0e639c] font-mono text-sm"
            />
            <button
              onClick={handleSelectDirectory}
              className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/70 transition-colors"
              title="Browse"
            >
              📁
            </button>
            <button
              onClick={handleLoadHomeDirectory}
              className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/70 transition-colors"
              title="Home Directory"
            >
              🏠
            </button>
          </div>
        </div>

        {/* Color Picker */}
        <div className="mb-6">
          <label className="block text-sm text-white/70 mb-2">Color</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {PRESET_COLORS.map((presetColor) => (
              <button
                key={presetColor}
                onClick={() => {
                  setColor(presetColor);
                  setShowColorPicker(false);
                }}
                className={`w-8 h-8 rounded-lg border-2 transition-all ${
                  color === presetColor && !showColorPicker
                    ? "border-white scale-110"
                    : "border-white/20 hover:scale-110"
                }`}
                style={{ backgroundColor: presetColor }}
                title={presetColor}
              />
            ))}
            {/* Custom Color Button */}
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className={`w-8 h-8 rounded-lg border-2 transition-all flex items-center justify-center ${
                showColorPicker ? "border-white scale-110" : "border-white/20 hover:scale-110"
              }`}
              style={{
                background: showColorPicker && customColor ? customColor : "transparent",
              }}
              title="Custom color"
            >
              {!showColorPicker || !customColor ? "+" : ""}
            </button>
          </div>

          {/* Custom Color Input */}
          {showColorPicker && (
            <div className="flex gap-2 items-center mt-2">
              <input
                type="color"
                value={customColor || "#4ecdc4"}
                onChange={(e) => setCustomColor(e.target.value)}
                className="w-12 h-8 rounded cursor-pointer"
              />
              <input
                type="text"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                placeholder="#4ecdc4"
                className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded text-white placeholder:text-white/30 focus:outline-none focus:border-[#0e639c] font-mono text-sm"
              />
            </div>
          )}
        </div>

        {/* App Selection */}
        <div className="mb-6">
          <label className="block text-sm text-white/70 mb-2">Open With</label>
          <select
            value={selectedApp}
            onChange={(e) => setSelectedApp(e.target.value as NativeTerminalApp)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#0e639c]"
          >
            {AVAILABLE_APPS.map((app) => (
              <option key={app.id} value={app.id} className="bg-[#1e1e1e] text-white">
                {app.label}
              </option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!name.trim()}
            className="px-4 py-2 bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            Add Terminal
          </button>
        </div>
      </div>
    </div>
  );
}
