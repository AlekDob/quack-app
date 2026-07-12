import { invoke } from "@tauri-apps/api/core";
import type {
  ExtensionStatus,
  InstallMethod,
  InstallResult,
} from "./quackStore/types";

export type { ExtensionStatus, InstallResult };

export const quackExtensions = {
  status: (root: string) =>
    invoke<ExtensionStatus[]>("quack_extensions_status", { root }),

  install: (method: InstallMethod) => {
    if (method.kind === "pip") {
      return invoke<InstallResult>("quack_extensions_install", {
        method: { kind: "pip", package: method.package },
      });
    }
    if (method.kind === "cargo") {
      return invoke<InstallResult>("quack_extensions_install", {
        method: { kind: "cargo", crate_name: method.crate },
      });
    }
    return Promise.resolve<InstallResult>({
      ok: false,
      message: "Use the documentation link to install manually.",
      manual_command: null,
    });
  },
};

export function statusMap(
  rows: ExtensionStatus[],
): Map<string, ExtensionStatus> {
  return new Map(rows.map((r) => [r.id, r]));
}

export function installedIds(rows: ExtensionStatus[]): Set<string> {
  return new Set(rows.filter((r) => r.installed).map((r) => r.id));
}
