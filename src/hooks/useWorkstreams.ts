import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { DirectoryEntry } from "../types";

export type WorkstreamFocus =
  | "current"
  | "active"
  | "background"
  | "candidate"
  | "superseded"
  | "completed";

export interface Workstream {
  ws: number;
  title: string;
  status: string;
  focus: WorkstreamFocus;
  opened?: string;
  updated?: string;
  warning?: string;
  brand?: string;
  brands?: string[];
  filePath: string;
  fileName: string;
}

interface UseWorkstreamsResult {
  workstreams: Workstream[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const FOCUS_VALUES = new Set<WorkstreamFocus>([
  "current",
  "active",
  "background",
  "candidate",
  "superseded",
  "completed",
]);

function parseFrontmatter(content: string): Record<string, string | string[]> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const out: Record<string, string | string[]> = {};
  for (const line of match[1].split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!m) continue;
    const [, key, rawValue] = m;
    const value = rawValue.trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      out[key] = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      out[key] = value.replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

export function useWorkstreams(rootPath: string | null): UseWorkstreamsResult {
  const [workstreams, setWorkstreams] = useState<Workstream[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!rootPath) {
      setWorkstreams([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const dir = `${rootPath}/documentation/workstreams`;
      const listing = await invoke<{ path: string; entries: DirectoryEntry[] }>(
        "list_directory",
        { path: dir }
      );
      const files = listing.entries.filter(
        (e) => !e.is_dir && /^\d{2}-.+\.md$/.test(e.name)
      );
      const parsed: Workstream[] = [];
      for (const f of files) {
        try {
          const content = await invoke<string>("read_file_content", { path: f.path });
          const fm = parseFrontmatter(content);
          const wsNum = typeof fm.ws === "string" ? parseInt(fm.ws, 10) : NaN;
          const focusRaw = typeof fm.focus === "string" ? fm.focus : "candidate";
          const focus: WorkstreamFocus = FOCUS_VALUES.has(focusRaw as WorkstreamFocus)
            ? (focusRaw as WorkstreamFocus)
            : "candidate";
          parsed.push({
            ws: Number.isFinite(wsNum) ? wsNum : 0,
            title: (fm.title as string) || f.name,
            status: (fm.status as string) || "",
            focus,
            opened: fm.opened as string | undefined,
            updated: fm.updated as string | undefined,
            warning: fm.warning as string | undefined,
            brand: fm.brand as string | undefined,
            brands: Array.isArray(fm.brands) ? (fm.brands as string[]) : undefined,
            filePath: f.path,
            fileName: f.name,
          });
        } catch {
          // skip unreadable file
        }
      }
      parsed.sort((a, b) => a.ws - b.ws);
      setWorkstreams(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setWorkstreams([]);
    } finally {
      setLoading(false);
    }
  }, [rootPath]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { workstreams, loading, error, refresh };
}
