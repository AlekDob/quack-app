// FILE: LinearCreateIssueDialog.tsx
// Purpose: Create a Linear issue from the composer `@` menu (title, description, images, team, project).
// Layer: Chat UI components

import type { LinearCycle, LinearIssue } from "@synara/contracts";
import { linearWorkspaceDisplayName } from "@synara/shared/linearMentions";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import type { ComposerImageAttachment } from "~/composerDraftStore";
import { PaperclipIcon } from "~/lib/icons";
import { useComposerDropzone } from "~/hooks/useComposerDropzone";
import { prepareComposerImageAttachmentsFromFiles } from "~/lib/composerSend";
import { buildLinearIssueDescription } from "~/lib/linearIssueDescription";
import {
  linearCreateOptionsQueryOptions,
  createLinearIssue,
  uploadLinearImage,
} from "~/lib/linearReactQuery";
import { readProjectLinearDefaults } from "~/lib/projectLinearDefaults";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  dialogFieldLabelClassName,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { toastManager } from "../ui/toast";
import { ComposerImageAttachmentChip } from "./ComposerImageAttachmentChip";
import { ExpandedImageOverlay } from "./ExpandedImageOverlay";
import type { ExpandedImagePreview } from "./ExpandedImagePreview";

const NO_PROJECT = "none";
const NO_CYCLE = "none";

function linearCycleLabel(cycle: LinearCycle): string {
  const label = cycle.name || `Cycle ${cycle.number}`;
  return cycle.isActive ? `${label} · Current` : label;
}

export function LinearCreateIssueDialog(props: {
  /** Null keeps the dialog closed; a string (possibly empty) opens it prefilled. */
  draftTitle: string | null;
  /** Project whose saved Linear team/project pre-fills this form. */
  projectId: string | null;
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
        {props.draftTitle !== null ? (
          <LinearCreateIssueForm
            draftTitle={props.draftTitle}
            projectId={props.projectId}
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
  projectId: string | null;
  onClose: () => void;
  onCreated: (issue: LinearIssue) => void;
}) {
  const optionsQuery = useQuery(linearCreateOptionsQueryOptions(true));
  const workspaces = optionsQuery.data?.workspaces ?? [];
  const [title, setTitle] = useState(props.draftTitle);
  const [description, setDescription] = useState("");
  // Read at mount, not during the parent's render: React Compiler caches a
  // render-time read keyed on the project id, so a default saved while the chat
  // was already open would never reach this form.
  const [defaults] = useState(() =>
    props.projectId === null ? null : readProjectLinearDefaults(props.projectId),
  );
  const [workspaceId, setWorkspaceId] = useState<string | null>(defaults?.workspaceId ?? null);
  const [teamId, setTeamId] = useState<string | null>(defaults?.teamId ?? null);
  const [projectId, setProjectId] = useState(defaults?.projectId ?? NO_PROJECT);
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const images = useLinearIssueImages();

  const selectedWorkspaceId = workspaceId ?? workspaces[0]?.workspace.id ?? null;
  const selectedWorkspace = workspaces.find((entry) => entry.workspace.id === selectedWorkspaceId);
  const teams = selectedWorkspace?.teams ?? [];
  const selectedTeamId = teamId ?? teams[0]?.id ?? null;
  const selectedTeam = teams.find((team) => team.id === selectedTeamId);
  const cycles = selectedTeam?.cycles ?? [];
  const selectedCycleId = cycleId ?? cycles.find((cycle) => cycle.isActive)?.id ?? NO_CYCLE;
  const selectedCycle = cycles.find((cycle) => cycle.id === selectedCycleId);
  const projects = (selectedWorkspace?.projects ?? []).filter(
    (project) => selectedTeamId !== null && project.teamIds.includes(selectedTeamId),
  );
  const canSave =
    title.trim().length > 0 && selectedWorkspaceId !== null && selectedTeamId !== null && !isSaving;

  const handleSubmit = async () => {
    if (!canSave || selectedWorkspaceId === null || selectedTeamId === null) return;
    setIsSaving(true);
    try {
      // Upload at submit, not at paste: cancelling the dialog then leaves no
      // orphan assets on Linear. Sequential, so several large images never
      // buffer at once.
      const uploaded: { name: string; assetUrl: string }[] = [];
      for (const image of images.items) {
        const assetUrl = await uploadLinearImage({
          workspaceId: selectedWorkspaceId,
          file: image.file,
        });
        uploaded.push({ name: image.name, assetUrl });
      }
      const body = buildLinearIssueDescription(description, uploaded);
      const issue = await createLinearIssue({
        workspaceId: selectedWorkspaceId,
        title: title.trim(),
        teamId: selectedTeamId,
        ...(projectId === NO_PROJECT ? {} : { projectId }),
        ...(selectedCycleId === NO_CYCLE ? {} : { cycleId: selectedCycleId }),
        ...(body.length > 0 ? { description: body } : {}),
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
        {/* Drag/paste handlers live on a wrapper div: the hook types drag events for
            HTMLDivElement, and paste bubbles so it works from the title too. */}
        <div
          onPaste={images.dropzone.onComposerPaste}
          onDragEnter={images.dropzone.onComposerDragEnter}
          onDragOver={images.dropzone.onComposerDragOver}
          onDragLeave={images.dropzone.onComposerDragLeave}
          onDrop={images.dropzone.onComposerDrop}
        >
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
            <label className="grid gap-1.5">
              <span className={dialogFieldLabelClassName}>Description</span>
              <Textarea
                placeholder="Add context, or paste a screenshot"
                value={description}
                disabled={isSaving}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <LinearCreateIssueImages images={images} disabled={isSaving} />
            {workspaces.length > 1 ? (
              <Select
                value={selectedWorkspaceId ?? ""}
                onValueChange={(value) => {
                  setWorkspaceId(value);
                  setTeamId(null);
                  setProjectId(NO_PROJECT);
                  setCycleId(null);
                }}
              >
                <SelectTrigger size="sm" className="w-full" aria-label="Linear workspace">
                  <SelectValue>
                    {selectedWorkspace
                      ? linearWorkspaceDisplayName(selectedWorkspace.workspace)
                      : optionsQuery.isLoading
                        ? "Loading workspaces..."
                        : "Select a workspace"}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup surface="settings">
                  {workspaces.map((entry) => (
                    <SelectItem key={entry.workspace.id} value={entry.workspace.id}>
                      {linearWorkspaceDisplayName(entry.workspace)}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            ) : null}
            <Select
              value={selectedTeamId ?? ""}
              onValueChange={(value) => {
                setTeamId(value);
                setProjectId(NO_PROJECT);
                setCycleId(null);
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
            {cycles.length > 0 ? (
              <Select
                value={selectedCycleId}
                onValueChange={(value) => setCycleId(value ?? NO_CYCLE)}
              >
                <SelectTrigger size="sm" className="w-full" aria-label="Linear cycle">
                  <SelectValue>
                    {selectedCycleId === NO_CYCLE
                      ? "No cycle"
                      : selectedCycle
                        ? linearCycleLabel(selectedCycle)
                        : "No cycle"}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup surface="settings">
                  <SelectItem value={NO_CYCLE}>No cycle</SelectItem>
                  {cycles.map((cycle) => (
                    <SelectItem key={cycle.id} value={cycle.id}>
                      {linearCycleLabel(cycle)}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            ) : null}
          </form>
        </div>
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

type LinearIssueImages = ReturnType<typeof useLinearIssueImages>;

/**
 * Image drafts for the issue body. Reuses the composer pipeline so paste, drag&drop
 * and the size/type guards behave exactly like they do in the chat composer.
 */
function useLinearIssueImages() {
  const [items, setItems] = useState<readonly ComposerImageAttachment[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [expandedImage, setExpandedImage] = useState<ExpandedImagePreview | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Preview blobs are ours to free: the dialog unmounts on close, so nobody else can.
  useEffect(
    () => () => {
      for (const item of itemsRef.current) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
    },
    [],
  );

  const addFiles = (files: readonly File[]) => {
    void (async () => {
      const result = await prepareComposerImageAttachmentsFromFiles({
        files,
        existingAttachmentCount: itemsRef.current.length,
      });
      if (result.images.length > 0) setItems((existing) => [...existing, ...result.images]);
      if (result.error) {
        toastManager.add({ type: "warning", title: "Image not added", description: result.error });
      }
    })();
  };

  const remove = (imageId: string) => {
    setItems((existing) => {
      const removed = existing.find((item) => item.id === imageId);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return existing.filter((item) => item.id !== imageId);
    });
  };

  const dropzone = useComposerDropzone({
    addImages: addFiles,
    fileSupport: {
      genericFiles: "reject",
      onUnsupportedFiles: (files) => {
        toastManager.add({
          type: "warning",
          title: "Only images can be attached to a Linear issue.",
          description:
            files.length === 1 ? "That file was not added." : `${files.length} files were skipped.`,
        });
      },
    },
    setIsDragOverComposer: setIsDragOver,
  });

  return { items, addFiles, remove, dropzone, isDragOver, expandedImage, setExpandedImage };
}

function LinearCreateIssueImages(props: { images: LinearIssueImages; disabled: boolean }) {
  const { images } = props;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="flex flex-col gap-2">
      {images.items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {images.items.map((image) => (
            <ComposerImageAttachmentChip
              key={image.id}
              image={image}
              images={images.items}
              nonPersisted={false}
              onExpandImage={images.setExpandedImage}
              onRemoveImage={images.remove}
            />
          ))}
        </div>
      ) : null}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          images.addFiles(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        disabled={props.disabled}
        onClick={() => fileInputRef.current?.click()}
      >
        <PaperclipIcon className="size-3.5" />
        {images.isDragOver ? "Drop to attach" : "Add image"}
      </Button>
      <ExpandedImageOverlay
        expandedImage={images.expandedImage}
        onClose={() => images.setExpandedImage(null)}
        onNavigate={(direction) =>
          images.setExpandedImage((existing) =>
            !existing || existing.images.length <= 1
              ? existing
              : {
                  ...existing,
                  index:
                    (existing.index + direction + existing.images.length) % existing.images.length,
                },
          )
        }
      />
    </div>
  );
}
