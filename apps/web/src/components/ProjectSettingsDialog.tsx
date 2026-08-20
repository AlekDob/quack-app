import { PROVIDER_DISPLAY_NAMES, type ProviderKind } from "@synara/contracts";
import { linearWorkspaceDisplayName } from "@synara/shared/linearMentions";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { linearCreateOptionsQueryOptions } from "~/lib/linearReactQuery";
import {
  readProjectLinearDefaults,
  writeProjectLinearDefaults,
  type ProjectLinearDefaults,
} from "~/lib/projectLinearDefaults";

import { ProviderIcon } from "./ProviderIcon";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  dialogFieldLabelClassName,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { DisclosureChevron } from "./ui/DisclosureChevron";
import { DisclosureRegion } from "./ui/DisclosureRegion";
import { Select, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ComposerPickerSelectPopup } from "./chat/ComposerPickerMenuPopup";

const NO_TEAM = "none";
const NO_PROJECT = "none";

export function ProjectSettingsDialog(props: {
  open: boolean;
  projectId: string;
  initialName: string;
  placeholder: string | undefined;
  provider: ProviderKind;
  providers: ReadonlyArray<ProviderKind>;
  onOpenChange: (open: boolean) => void;
  onSave: (value: { name: string; provider: ProviderKind }) => Promise<void> | void;
}) {
  const providers = props.providers.includes(props.provider)
    ? props.providers
    : [props.provider, ...props.providers];

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogPopup className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
        </DialogHeader>
        <ProjectSettingsForm
          key={`${props.projectId}:${props.initialName}:${props.provider}`}
          projectId={props.projectId}
          initialName={props.initialName}
          placeholder={props.placeholder}
          provider={props.provider}
          providers={providers}
          onOpenChange={props.onOpenChange}
          onSave={props.onSave}
        />
      </DialogPopup>
    </Dialog>
  );
}

function ProjectSettingsForm(props: {
  projectId: string;
  initialName: string;
  placeholder: string | undefined;
  provider: ProviderKind;
  providers: ReadonlyArray<ProviderKind>;
  onOpenChange: (open: boolean) => void;
  onSave: (value: { name: string; provider: ProviderKind }) => Promise<void> | void;
}) {
  const [name, setName] = useState(props.initialName);
  const [provider, setProvider] = useState(props.provider);
  const [linear, setLinear] = useState<ProjectLinearDefaults | null>(() =>
    readProjectLinearDefaults(props.projectId),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const save = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      await props.onSave({ name: name.trim(), provider });
      writeProjectLinearDefaults(props.projectId, linear);
      props.onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the project.");
      setIsSaving(false);
    }
  };

  return (
    <>
      <DialogPanel className="space-y-4">
        <div className="space-y-2">
          <span className={dialogFieldLabelClassName}>Name</span>
          <Input
            ref={inputRef}
            size="lg"
            value={name}
            placeholder={props.placeholder}
            disabled={isSaving}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                props.onOpenChange(false);
              }
            }}
          />
        </div>
        <div className="space-y-2">
          <span className={dialogFieldLabelClassName}>Default provider</span>
          <Select
            value={provider}
            onValueChange={(next) => {
              if (typeof next === "string") setProvider(next as ProviderKind);
            }}
          >
            <SelectTrigger aria-label="Default provider">
              <SelectValue>
                <span className="flex items-center gap-2">
                  <ProviderIcon provider={provider} className="size-3.5" />
                  {PROVIDER_DISPLAY_NAMES[provider]}
                </span>
              </SelectValue>
            </SelectTrigger>
            <ComposerPickerSelectPopup align="start">
              {props.providers.map((option) => (
                <SelectItem key={option} value={option}>
                  <span className="flex items-center gap-2">
                    <ProviderIcon provider={option} className="size-3.5" />
                    {PROVIDER_DISPLAY_NAMES[option]}
                  </span>
                </SelectItem>
              ))}
            </ComposerPickerSelectPopup>
          </Select>
        </div>
        <ProjectLinearFields value={linear} disabled={isSaving} onChange={setLinear} />
        {error ? (
          <p
            role="alert"
            className="text-[length:var(--app-font-size-ui-xs,10px)] text-destructive"
          >
            {error}
          </p>
        ) : null}
      </DialogPanel>
      <DialogFooter>
        <Button
          variant="outline"
          size="sm"
          onClick={() => props.onOpenChange(false)}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button size="sm" onClick={() => void save()} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Optional Linear team/project this project is associated with. Hidden entirely
 * when no Linear workspace is connected, so there is nothing dead to pick from.
 */
function ProjectLinearFields(props: {
  value: ProjectLinearDefaults | null;
  disabled: boolean;
  onChange: (value: ProjectLinearDefaults | null) => void;
}) {
  const optionsQuery = useQuery(linearCreateOptionsQueryOptions(true));
  // Collapsed unless this project already points somewhere: the common edit is
  // the name, and an unset optional field should not cost two rows of dialog.
  const [open, setOpen] = useState(props.value !== null);
  const workspaces = optionsQuery.data?.workspaces ?? [];
  if (workspaces.length === 0) return null;

  // Teams from every connected workspace in one list: a third "workspace" select
  // would only ever be used to narrow this one.
  const teams = workspaces.flatMap((entry) =>
    entry.teams.map((team) => ({
      key: `${entry.workspace.id}:${team.id}`,
      workspaceId: entry.workspace.id,
      label:
        workspaces.length > 1
          ? `${linearWorkspaceDisplayName(entry.workspace)} · ${team.key} — ${team.name}`
          : `${team.key} — ${team.name}`,
      team,
    })),
  );
  const selectedKey = props.value ? `${props.value.workspaceId}:${props.value.teamId}` : NO_TEAM;
  const selected = teams.find((option) => option.key === selectedKey) ?? null;
  const projects = (
    workspaces.find((entry) => entry.workspace.id === selected?.workspaceId)?.projects ?? []
  ).filter((project) => selected !== null && project.teamIds.includes(selected.team.id));

  const selectedProjectName =
    projects.find((project) => project.id === props.value?.projectId)?.name ?? null;
  const summary = selected
    ? [selected.label, selectedProjectName].filter(Boolean).join(" · ")
    : "Not set";

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left"
      >
        <span className={dialogFieldLabelClassName}>Linear (optional)</span>
        <span className="min-w-0 flex-1 truncate text-right text-[length:var(--app-font-size-ui-xs,10px)] text-muted-foreground">
          {summary}
        </span>
        <DisclosureChevron open={open} className="size-3.5 shrink-0 text-muted-foreground" />
      </button>
      <DisclosureRegion open={open} contentClassName="space-y-3 pt-1">
        <div className="space-y-2">
          <span className={dialogFieldLabelClassName}>Team</span>
          <Select
            value={selectedKey}
            disabled={props.disabled}
            onValueChange={(next) => {
              const option = teams.find((entry) => entry.key === next) ?? null;
              props.onChange(
                option === null
                  ? null
                  : { workspaceId: option.workspaceId, teamId: option.team.id, projectId: null },
              );
            }}
          >
            <SelectTrigger aria-label="Linear team">
              <SelectValue>{selected?.label ?? "No team"}</SelectValue>
            </SelectTrigger>
            <ComposerPickerSelectPopup align="start">
              <SelectItem value={NO_TEAM}>No team</SelectItem>
              {teams.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </ComposerPickerSelectPopup>
          </Select>
        </div>
        {selected !== null ? (
          <div className="space-y-2">
            <span className={dialogFieldLabelClassName}>Project</span>
            <Select
              value={props.value?.projectId ?? NO_PROJECT}
              disabled={props.disabled}
              onValueChange={(next) => {
                if (props.value === null) return;
                props.onChange({
                  ...props.value,
                  projectId: next === NO_PROJECT || typeof next !== "string" ? null : next,
                });
              }}
            >
              <SelectTrigger aria-label="Linear project">
                <SelectValue>
                  {projects.find((project) => project.id === props.value?.projectId)?.name ??
                    "No project"}
                </SelectValue>
              </SelectTrigger>
              <ComposerPickerSelectPopup align="start">
                <SelectItem value={NO_PROJECT}>No project</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </ComposerPickerSelectPopup>
            </Select>
          </div>
        ) : null}
      </DisclosureRegion>
    </div>
  );
}
