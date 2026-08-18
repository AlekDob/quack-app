// FILE: LinearCreateIssueDialog.tsx
// Purpose: Create a Linear issue from the composer `@` menu (title, team, optional project).
// Layer: Chat UI components

import type { LinearIssue } from "@synara/contracts";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { linearCreateOptionsQueryOptions, createLinearIssue } from "~/lib/linearReactQuery";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { toastManager } from "../ui/toast";

const NO_PROJECT = "none";

export function LinearCreateIssueDialog(props: {
  /** Null keeps the dialog closed; a string (possibly empty) opens it prefilled. */
  draftTitle: string | null;
  onClose: () => void;
  onCreated: (issue: LinearIssue) => void;
}) {
  return (
    <Dialog open={props.draftTitle !== null} onOpenChange={(open) => !open && props.onClose()}>
      <DialogPopup className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Linear issue</DialogTitle>
          <DialogDescription>Creates a Linear issue and inserts it in this chat.</DialogDescription>
        </DialogHeader>
        {/* Form state lives below DialogPopup, which unmounts on close, so each
            open starts from a fresh draft without a reset effect. */}
        {props.draftTitle !== null ? (
          <LinearCreateIssueForm
            draftTitle={props.draftTitle}
            onClose={props.onClose}
            onCreated={props.onCreated}
          />
        ) : null}
      </DialogPopup>
    </Dialog>
  );
}

function LinearCreateIssueForm(props: {
  draftTitle: string;
  onClose: () => void;
  onCreated: (issue: LinearIssue) => void;
}) {
  const optionsQuery = useQuery(linearCreateOptionsQueryOptions(true));
  const teams = optionsQuery.data?.teams ?? [];
  const [title, setTitle] = useState(props.draftTitle);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState(NO_PROJECT);
  const [isSaving, setIsSaving] = useState(false);

  const selectedTeamId = teamId ?? teams[0]?.id ?? null;
  const projects = (optionsQuery.data?.projects ?? []).filter(
    (project) => selectedTeamId !== null && project.teamIds.includes(selectedTeamId),
  );
  const canSave = title.trim().length > 0 && selectedTeamId !== null && !isSaving;

  const handleSubmit = async () => {
    if (!canSave || selectedTeamId === null) return;
    setIsSaving(true);
    try {
      const issue = await createLinearIssue({
        title: title.trim(),
        teamId: selectedTeamId,
        ...(projectId === NO_PROJECT ? {} : { projectId }),
      });
      props.onCreated(issue);
      props.onClose();
    } catch (error: unknown) {
      setIsSaving(false);
      toastManager.add({
        type: "error",
        title: "Could not create the Linear issue",
        description: error instanceof Error ? error.message : "Linear rejected the request.",
      });
    }
  };

  return (
    <>
      <DialogPanel>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <Input
            autoFocus
            size="lg"
            placeholder="Issue title"
            value={title}
            disabled={isSaving}
            onChange={(event) => setTitle(event.target.value)}
          />
          <Select
            value={selectedTeamId ?? ""}
            onValueChange={(value) => {
              setTeamId(value);
              setProjectId(NO_PROJECT);
            }}
          >
            <SelectTrigger size="sm" className="w-full" aria-label="Linear team">
              <SelectValue>
                {teams.find((team) => team.id === selectedTeamId)?.name ??
                  (optionsQuery.isLoading ? "Loading teams..." : "Select a team")}
              </SelectValue>
            </SelectTrigger>
            <SelectPopup surface="settings">
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.key} — {team.name}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
          <Select value={projectId} onValueChange={(value) => setProjectId(value ?? NO_PROJECT)}>
            <SelectTrigger size="sm" className="w-full" aria-label="Linear project">
              <SelectValue>
                {projects.find((project) => project.id === projectId)?.name ?? "No project"}
              </SelectValue>
            </SelectTrigger>
            <SelectPopup surface="settings">
              <SelectItem value={NO_PROJECT}>No project</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </form>
      </DialogPanel>
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={props.onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => void handleSubmit()} disabled={!canSave}>
          {isSaving ? "Creating..." : "Create"}
        </Button>
      </DialogFooter>
    </>
  );
}
