import { useCallback, useEffect, useState } from "react";
import { errMsg, error as toastError, success as toastSuccess } from "../../notify";
import {
  getPlaneConfig,
  getPlaneToken,
  setPlaneConfig,
  setPlaneToken,
  type PlaneWorkspaceConfig,
} from "../../worksPlaneSettings";
import { syncWorksToPlane } from "../../planeSync";
import type { WorksSnapshot } from "../../works";
import { Icon } from "../Icon";

type Props = {
  wsId: string;
  root: string;
  snap: WorksSnapshot | null;
};

export function WorksPlanePanel({ wsId, root, snap }: Props) {
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState<PlaneWorkspaceConfig>(() => getPlaneConfig(wsId));
  const [token, setToken] = useState(() => getPlaneToken(wsId) ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCfg(getPlaneConfig(wsId));
    setToken(getPlaneToken(wsId) ?? "");
  }, [open, wsId]);

  const save = () => {
    setPlaneConfig(wsId, cfg);
    setPlaneToken(wsId, token.trim() || null);
    toastSuccess("Plane settings saved");
    setOpen(false);
  };

  const syncAll = async () => {
    if (!snap) return;
    setBusy(true);
    try {
      setPlaneConfig(wsId, cfg);
      setPlaneToken(wsId, token.trim() || null);
      const n = await syncWorksToPlane(wsId, root, snap);
      toastSuccess(`Synced ${n} work items to Plane`);
    } catch (e) {
      toastError(`Plane sync failed: ${errMsg(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const patch = useCallback(
    (p: Partial<PlaneWorkspaceConfig>) => setCfg((c) => ({ ...c, ...p })),
    [],
  );

  return (
    <>
      <button
        type="button"
        className="works-plane-btn"
        onClick={() => setOpen((o) => !o)}
        title="Plane sync settings"
        aria-expanded={open}
      >
        <Icon name="cloud" size={12} />
        Plane
      </button>
      {open && (
        <div className="works-plane-panel">
          <label className="works-plane-row">
            <input
              type="checkbox"
              checked={cfg.enabled}
              onChange={(e) => patch({ enabled: e.target.checked })}
            />
            Enable Plane sync
          </label>
          <input
            className="works-plane-input"
            placeholder="Base URL"
            value={cfg.baseUrl}
            onChange={(e) => patch({ baseUrl: e.target.value })}
          />
          <input
            className="works-plane-input"
            placeholder="Workspace slug"
            value={cfg.workspaceSlug}
            onChange={(e) => patch({ workspaceSlug: e.target.value })}
          />
          <input
            className="works-plane-input"
            placeholder="Project ID"
            value={cfg.projectId}
            onChange={(e) => patch({ projectId: e.target.value })}
          />
          <input
            className="works-plane-input"
            placeholder="API token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <div className="works-plane-actions">
            <button type="button" className="works-plane-action" onClick={save}>
              Save
            </button>
            <button
              type="button"
              className="works-plane-action"
              disabled={busy || !snap}
              onClick={() => void syncAll()}
            >
              {busy ? "Syncing…" : "Sync all"}
            </button>
            <button
              type="button"
              className="works-plane-action"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
