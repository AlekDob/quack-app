import { Icon } from "./Icon";
import type { QuackExtension } from "../quackStore/types";
import type { ExtensionStatus } from "../quackExtensions";
import { success as toastSuccess } from "../notify";

export type RowPhase = "idle" | "busy" | "error";

type Props = {
  ext: QuackExtension;
  status: ExtensionStatus | undefined;
  phase: RowPhase;
  busyLabel: string;
  errorMsg: string | null;
  manualCmd: string | null;
  onInstall: () => void;
  onOpenBrain: () => void;
};

function statusMeta(
  ext: QuackExtension,
  status: ExtensionStatus | undefined,
): { dot: "ok" | "warn" | "off"; line: string } {
  const installed = status?.installed ?? false;
  const setupNeeded =
    installed && status?.workspace_ready === false && ext.id === "pinky-brain";
  if (!installed) {
    return { dot: "off", line: "Not installed" };
  }
  if (setupNeeded) {
    return { dot: "warn", line: "Setup needed" };
  }
  const ver = status?.version?.replace(/^pinky\s*/i, "").trim();
  return {
    dot: "ok",
    line: ver ? `Installed · ${ver}` : "Installed",
  };
}

function subtitle(
  ext: QuackExtension,
  status: ExtensionStatus | undefined,
  phase: RowPhase,
  busyLabel: string,
): string {
  if (phase === "busy") return busyLabel;
  const meta = statusMeta(ext, status);
  if (!(status?.installed ?? false)) {
    return `${meta.line} · ${ext.tagline}`;
  }
  return meta.line;
}

export function StoreExtensionRow({
  ext,
  status,
  phase,
  busyLabel,
  errorMsg,
  manualCmd,
  onInstall,
  onOpenBrain,
}: Props) {
  const installed = status?.installed ?? false;
  const meta = statusMeta(ext, status);
  const sub = subtitle(ext, status, phase, busyLabel);

  const copyCmd = async () => {
    if (!manualCmd) return;
    try {
      await navigator.clipboard.writeText(manualCmd);
      toastSuccess("Command copied");
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className={`store-row${phase === "busy" ? " is-busy" : ""}${installed ? " is-installed" : ""}${errorMsg ? " is-error" : ""}`}
    >
      <div className="store-row-main">
        <div className={`store-row-icon tint-${ext.tint}`} aria-hidden="true">
          <Icon name={ext.icon} size={18} />
          <span className={`store-status-dot ${meta.dot}`} />
        </div>

        <div className="store-row-body">
          <div className="store-row-head">
            <span className="store-row-name">{ext.name}</span>
            <span className={`store-cat-badge cat-${ext.category}`}>{ext.category}</span>
          </div>
          <p className="store-row-sub" title={ext.description}>
            {sub}
          </p>
        </div>

        <div className="store-row-actions">
          {phase === "busy" ? (
            <span className="store-busy-label brain-search-shimmer" aria-live="polite">
              Working…
            </span>
          ) : (
            <>
              {!installed ? (
                <button
                  type="button"
                  className="store-row-btn primary"
                  onClick={onInstall}
                >
                  Install
                </button>
              ) : (
                <button
                  type="button"
                  className="store-row-btn"
                  onClick={onOpenBrain}
                >
                  Open
                </button>
              )}
              <a
                className="store-row-link"
                href={ext.docsUrl}
                target="_blank"
                rel="noreferrer"
              >
                Docs
              </a>
            </>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="store-row-error">
          <p className="store-error-msg">{errorMsg}</p>
          {manualCmd && (
            <button type="button" className="store-cmd-pill" onClick={() => void copyCmd()}>
              {manualCmd}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function StoreSkeletonRows({ count = 2 }: { count?: number }) {
  return (
    <div className="store-list">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="store-row store-row-skeleton">
          <div className="brain-result-skeleton" style={{ height: 48, borderRadius: 6 }} />
        </div>
      ))}
    </div>
  );
}
