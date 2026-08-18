// FILE: CompanionSettingsPanel.tsx
// Purpose: Own the Companion (astronaut) server URL and its connection test.
// Layer: Settings panel

import { pluralize } from "@synara/shared/text";
import { useMutation } from "@tanstack/react-query";

import type { AppSettingsBinding } from "~/appSettings";
import { Loader2Icon } from "~/lib/icons";
import { cn } from "~/lib/utils";
import { ensureNativeApi } from "~/nativeApi";
import { Button } from "../ui/button";
import { DebouncedSettingTextInput } from "./DebouncedSettingTextInput";
import { SettingResetButton } from "./SettingControls";
import { SettingsRow, SettingsSection } from "./SettingsPanelPrimitives";

export type CompanionTestResult = { readonly models: number; readonly ms: number };

/**
 * Companion is an HTTP service, not a CLI, so the reachability check reuses the existing
 * `provider.listModels` RPC: a successful `GET {url}/models` proves the server is up AND
 * answering, without any new server-side endpoint.
 */
export async function runCompanionConnectionTest(url: string): Promise<CompanionTestResult> {
  const startedAt = performance.now();
  const result = await ensureNativeApi().provider.listModels({
    provider: "astronaut",
    apiEndpoint: url,
  });
  // A disabled provider short-circuits listModels to an empty list, which would
  // otherwise read as "Connected · 0 models" while the composer says Unavailable.
  if (result.source === "disabled") {
    throw new Error("Companion is turned off. Enable it in Providers to use this connection.");
  }
  return { models: result.models.length, ms: Math.round(performance.now() - startedAt) };
}

export function CompanionSettingsPanel({
  settings,
  defaults,
  updateSettings,
  active,
}: AppSettingsBinding & { readonly active: boolean }) {
  const serverUrl = settings.astronautServerUrl.trim();
  const test = useMutation<CompanionTestResult, Error, string>({
    mutationFn: runCompanionConnectionTest,
  });

  if (!active) return null;

  return (
    <div className="space-y-6">
      <SettingsSection title="Connection">
        <SettingsRow
          title="Server URL"
          description="Where your Companion is reachable, usually a Tailscale host."
          resetAction={
            settings.astronautServerUrl !== defaults.astronautServerUrl ? (
              <SettingResetButton
                label="Companion server URL"
                onClick={() => updateSettings({ astronautServerUrl: defaults.astronautServerUrl })}
              />
            ) : null
          }
          status={<CompanionTestStatus test={test} />}
        >
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <DebouncedSettingTextInput
              id="companion-server-url"
              size="sm"
              variant="soft"
              className="flex-1"
              value={settings.astronautServerUrl}
              onCommit={(nextValue) => updateSettings({ astronautServerUrl: nextValue })}
              placeholder="http://imac-di-alek:4567"
              spellCheck={false}
              aria-label="Companion server URL"
            />
            <Button
              type="button"
              size="xs"
              variant="outline"
              className="sm:w-auto"
              disabled={!serverUrl || test.isPending}
              onClick={() => test.mutate(serverUrl)}
            >
              {test.isPending ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
              {test.isPending ? "Testing" : "Test connection"}
            </Button>
          </div>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

export function CompanionTestStatus({
  test,
}: {
  test: {
    readonly isPending: boolean;
    readonly data: CompanionTestResult | undefined;
    readonly error: Error | null;
  };
}) {
  if (test.isPending) return null;
  const failed = Boolean(test.error);
  const message = test.error
    ? test.error.message || "Companion is not reachable at this URL."
    : test.data
      ? `Connected · ${test.data.models} ${pluralize(test.data.models, "model")} · ${test.data.ms} ms`
      : null;
  if (!message) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full", failed ? "bg-destructive" : "bg-emerald-500")}
      />
      {message}
    </span>
  );
}
