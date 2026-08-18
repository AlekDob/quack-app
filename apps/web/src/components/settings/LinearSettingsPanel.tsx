// FILE: LinearSettingsPanel.tsx
// Purpose: Connect Quack to Linear with a personal API key so `@` can list and create issues.
// Layer: Settings UI components

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  DEFAULT_LINEAR_RENAME_CHAT,
  type LinearRenameChat,
  useAppSettings,
} from "~/appSettings";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { toastManager } from "~/components/ui/toast";
import { serverQueryKeys, serverSettingsQueryOptions } from "~/lib/serverReactQuery";
import { ensureNativeApi } from "~/nativeApi";
import { SettingResetButton, SettingsSegmentedControl } from "./SettingControls";
import { SettingsRow, SettingsSection } from "./SettingsPanelPrimitives";

const LINEAR_RENAME_CHAT_OPTIONS = [
  { value: "ask", label: "Ask" },
  { value: "always", label: "Always" },
  { value: "never", label: "Never" },
] as const satisfies ReadonlyArray<{ value: LinearRenameChat; label: string }>;

export function LinearSettingsPanel(props: { active: boolean }) {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const { settings, updateSettings } = useAppSettings();
  const settingsQuery = useQuery({ ...serverSettingsQueryOptions(), enabled: props.active });
  const configured = settingsQuery.data?.linear.apiKeyConfigured ?? false;

  const saveMutation = useMutation({
    // An empty string clears the stored key, so the same mutation covers save and disconnect.
    mutationFn: (nextKey: string) =>
      ensureNativeApi().server.updateSettings({ linear: { apiKey: nextKey } }),
    onSuccess: (_result, nextKey) => {
      setApiKey("");
      void queryClient.invalidateQueries({ queryKey: serverQueryKeys.settings() });
      toastManager.add({
        type: "success",
        title: nextKey ? "Linear connected" : "Linear disconnected",
      });
    },
    onError: (error: unknown) =>
      toastManager.add({
        type: "error",
        title: "Could not save the Linear API key",
        description: error instanceof Error ? error.message : "Settings update failed.",
      }),
  });

  if (!props.active) return null;

  return (
    <div className="space-y-6">
      <SettingsSection title="Connection">
        <SettingsRow
          title="Issues in chat"
          description="Connect Linear, then type @ in a chat to pick an open issue or create a new one. Picking an issue inserts a chip. It does not change status, assignee, or git branches."
          status={configured ? "Connected" : "Not connected"}
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
        <SettingsRow
          title="API key"
          description="Create a personal key in Linear under Settings → Security & access → Personal API keys. Paste it here. Quack keeps it in this machine's secret store."
        >
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              className="flex-1"
              type="password"
              autoComplete="new-password"
              placeholder={configured ? "Key configured" : "lin_api_..."}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              aria-label="Linear API key"
            />
            <Button
              size="sm"
              disabled={apiKey.trim().length === 0 || saveMutation.isPending}
              onClick={() => saveMutation.mutate(apiKey.trim())}
            >
              Save
            </Button>
            {configured ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate("")}
              >
                Disconnect
              </Button>
            ) : null}
          </div>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
