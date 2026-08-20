// FILE: LinearSettingsPanel.tsx
// Purpose: Connect one or more Linear workspaces so `@` can list and create issues.
// Layer: Settings UI components

import { LINEAR_WORKSPACE_LABEL_MAX, type LinearWorkspace } from "@synara/contracts";
import { linearWorkspaceDisplayName } from "@synara/shared/linearMentions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { DEFAULT_LINEAR_RENAME_CHAT, type LinearRenameChat, useAppSettings } from "~/appSettings";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { toastManager } from "~/components/ui/toast";
import { serverQueryKeys, serverSettingsQueryOptions } from "~/lib/serverReactQuery";
import { ensureNativeApi } from "~/nativeApi";
import {
  SETTINGS_CARD_ROW_CLASS_NAME,
  SETTINGS_CARD_ROW_DESCRIPTION_CLASS_NAME,
} from "~/settingsPanelStyles";
import { DebouncedSettingTextInput } from "./DebouncedSettingTextInput";
import { SettingResetButton, SettingsSegmentedControl } from "./SettingControls";
import { SettingsRow, SettingsSection } from "./SettingsPanelPrimitives";

const LINEAR_RENAME_CHAT_OPTIONS = [
  { value: "ask", label: "Ask" },
  { value: "always", label: "Always" },
  { value: "never", label: "Never" },
] as const satisfies ReadonlyArray<{ value: LinearRenameChat; label: string }>;

const PLACEHOLDER_WORKSPACE: LinearWorkspace = {
  id: "legacy",
  name: "Linear",
  urlKey: "linear",
};

function LinearWorkspaceRow(props: {
  workspace: LinearWorkspace;
  disconnectPending: boolean;
  onRename: (workspaceId: string, label: string) => void;
  onDisconnect: (workspaceId: string) => void;
}) {
  const displayName = linearWorkspaceDisplayName(props.workspace);
  return (
    <div className={SETTINGS_CARD_ROW_CLASS_NAME} data-slot="settings-row">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-0.5">
          <DebouncedSettingTextInput
            size="sm"
            variant="soft"
            className="max-w-xs"
            value={displayName}
            placeholder={props.workspace.name}
            maxLength={LINEAR_WORKSPACE_LABEL_MAX}
            aria-label={`Name for ${props.workspace.name}`}
            onCommit={(label) => props.onRename(props.workspace.id, label)}
          />
          <div className={SETTINGS_CARD_ROW_DESCRIPTION_CLASS_NAME}>
            {props.workspace.id === "legacy"
              ? "Personal API key saved on this machine"
              : `linear.app/${props.workspace.urlKey}`}
          </div>
        </div>
        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto sm:justify-end">
          <Badge variant="success" size="sm">
            Connected
          </Badge>
          <Button
            size="xs"
            variant="outline"
            disabled={props.disconnectPending}
            aria-label={`Disconnect ${displayName}`}
            onClick={() => props.onDisconnect(props.workspace.id)}
          >
            Disconnect
          </Button>
        </div>
      </div>
    </div>
  );
}

export function LinearSettingsPanel(props: { active: boolean }) {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const { settings, updateSettings } = useAppSettings();
  const settingsQuery = useQuery({ ...serverSettingsQueryOptions(), enabled: props.active });
  const workspaces = settingsQuery.data?.linear.workspaces ?? [];
  const configured = settingsQuery.data?.linear.apiKeyConfigured ?? false;
  const listedWorkspaces =
    workspaces.length > 0 ? workspaces : configured ? [PLACEHOLDER_WORKSPACE] : [];
  const hasWorkspace = listedWorkspaces.length > 0;

  const saveMutation = useMutation({
    mutationFn: (input: { apiKey: string; label: string }) =>
      ensureNativeApi().server.updateSettings({
        linear: {
          apiKey: input.apiKey,
          ...(input.label.trim().length > 0 ? { label: input.label.trim() } : {}),
        },
      }),
    onSuccess: () => {
      setApiKey("");
      setNewLabel("");
      void queryClient.invalidateQueries({ queryKey: serverQueryKeys.settings() });
      toastManager.add({ type: "success", title: "Linear workspace connected" });
    },
    onError: (error: unknown) =>
      toastManager.add({
        type: "error",
        title: "Could not save the Linear API key",
        description: error instanceof Error ? error.message : "Settings update failed.",
      }),
  });

  const renameMutation = useMutation({
    mutationFn: (input: { id: string; label: string }) =>
      ensureNativeApi().server.updateSettings({
        linear: { renameWorkspace: input },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: serverQueryKeys.settings() });
    },
    onError: (error: unknown) =>
      toastManager.add({
        type: "error",
        title: "Could not rename the Linear workspace",
        description: error instanceof Error ? error.message : "Settings update failed.",
      }),
  });

  const removeMutation = useMutation({
    mutationFn: (workspaceId: string) =>
      ensureNativeApi().server.updateSettings({ linear: { removeWorkspaceId: workspaceId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: serverQueryKeys.settings() });
      toastManager.add({ type: "success", title: "Linear workspace disconnected" });
    },
    onError: (error: unknown) =>
      toastManager.add({
        type: "error",
        title: "Could not disconnect Linear",
        description: error instanceof Error ? error.message : "Settings update failed.",
      }),
  });

  if (!props.active) return null;

  return (
    <div className="space-y-6">
      <SettingsSection title="Connection">
        <SettingsRow
          title="Issues in chat"
          description="Connect Linear, then type @ in a chat to pick an open issue or create a new one. Picking an issue inserts a chip. It does not change status, assignee, or git branches. Agents keep using the official Linear MCP you already configured — Quack does not replace it."
          status={
            listedWorkspaces.length > 0 ? `${listedWorkspaces.length} connected` : "Not connected"
          }
        />
        <SettingsRow
          title="Rename chat when picking an issue"
          description="Ask before renaming, always rename to the issue, or keep the current title."
          resetAction={
            settings.linearRenameChat !== DEFAULT_LINEAR_RENAME_CHAT ? (
              <SettingResetButton
                label="rename chat when picking an issue"
                onClick={() => updateSettings({ linearRenameChat: DEFAULT_LINEAR_RENAME_CHAT })}
              />
            ) : null
          }
          control={
            <SettingsSegmentedControl
              value={settings.linearRenameChat}
              onValueChange={(value) => updateSettings({ linearRenameChat: value })}
              ariaLabel="Rename chat when picking an issue"
              options={LINEAR_RENAME_CHAT_OPTIONS}
            />
          }
        />
        {listedWorkspaces.map((workspace) => (
          <LinearWorkspaceRow
            key={workspace.id}
            workspace={workspace}
            disconnectPending={removeMutation.isPending}
            onRename={(id, label) => renameMutation.mutate({ id, label })}
            onDisconnect={(id) => removeMutation.mutate(id)}
          />
        ))}
        <SettingsRow
          title={hasWorkspace ? "Add another workspace" : "Add workspace"}
          description={
            hasWorkspace
              ? "Give it a name, then paste a personal API key from that Linear workspace. Save adds it next to the ones above."
              : "Name is optional. Paste a personal API key from Linear → Settings → Security & access. Quack keeps it in this machine's secret store."
          }
        >
          <div className="mt-3 flex flex-col gap-2">
            <Input
              size="sm"
              placeholder="Name, e.g. Esopo"
              value={newLabel}
              maxLength={LINEAR_WORKSPACE_LABEL_MAX}
              onChange={(event) => setNewLabel(event.target.value)}
              aria-label="Workspace name"
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                className="flex-1"
                type="password"
                autoComplete="new-password"
                placeholder="lin_api_..."
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                aria-label="Linear API key"
              />
              <Button
                size="sm"
                disabled={apiKey.trim().length === 0 || saveMutation.isPending}
                onClick={() => saveMutation.mutate({ apiKey: apiKey.trim(), label: newLabel })}
              >
                Save
              </Button>
            </div>
          </div>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
