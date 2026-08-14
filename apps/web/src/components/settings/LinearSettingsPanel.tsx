// FILE: LinearSettingsPanel.tsx
// Purpose: Connect Quack to Linear with a personal API key so `@` can list and create issues.
// Layer: Settings UI components

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { toastManager } from "~/components/ui/toast";
import { serverQueryKeys, serverSettingsQueryOptions } from "~/lib/serverReactQuery";
import { ensureNativeApi } from "~/nativeApi";
import { SettingsRow, SettingsSection } from "./SettingsPanelPrimitives";

export function LinearSettingsPanel(props: { active: boolean }) {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
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
      <SettingsSection title="Linear">
        <SettingsRow
          title="API key"
          description="Type @ in the composer to pick a Linear issue. Picking one renames the thread. Create a personal API key in Linear under Settings, Security and access."
          status={configured ? "Configured" : "Not connected"}
          control={
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <Input
                className="w-full sm:w-64"
                type="password"
                autoComplete="new-password"
                placeholder={configured ? "Key configured" : "lin_api_..."}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
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
          }
        />
      </SettingsSection>
    </div>
  );
}
