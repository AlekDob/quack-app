// FILE: _chat.team.tsx
// Purpose: Manage the agent roster used by chats and projects.
// Layer: Routing

import type { ProjectId, TeamAgent, TeamRoster, TeamScope } from "@synara/contracts";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { RouteInsetSurface } from "~/components/RouteInsetSurface";
import { Button } from "~/components/ui/button";
import {
  dialogFieldLabelClassName,
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { DisclosureChevron } from "~/components/ui/DisclosureChevron";
import { DisclosureRegion } from "~/components/ui/DisclosureRegion";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { DUCK_COUNT, JACK_AVATAR_URL } from "~/lib/duckAvatars";
import { ensureNativeApi } from "~/nativeApi";
import { useStore } from "~/store";
import { getPaperoDefinition, type PaperoId } from "@synara/shared/paperi";

const LEGACY_MIGRATION_KEY = "synara:team:migrated:v1";
const LEGACY_STORAGE_KEY = "synara:paperi:v1";
const teamQueryKey = (scope: TeamScope) =>
  ["team", scope.kind, scope.kind === "project" ? scope.projectId : null] as const;

function avatarOptions(): string[] {
  return [
    JACK_AVATAR_URL,
    ...Array.from({ length: DUCK_COUNT }, (_, index) => `/images/ducks/duck${index + 1}.jpeg`),
  ];
}

function blankAgent(): TeamAgent {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    source: "custom",
    name: "",
    role: "Custom agent",
    avatar: "/images/ducks/duck1.jpeg",
    purpose: "Custom agent",
    instructions: "",
    modelSlots: {},
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

function migrateLegacyPaperi(roster: TeamRoster): Promise<void> | null {
  if (localStorage.getItem(LEGACY_MIGRATION_KEY)) return null;
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LEGACY_MIGRATION_KEY, "1");
      return null;
    }
    const legacy = JSON.parse(raw) as {
      version?: number;
      overridesByPaperoId?: Record<
        string,
        Partial<Pick<TeamAgent, "name" | "role" | "avatar" | "instructions">>
      >;
      modelSelectionByProviderByPaperoId?: Record<string, TeamAgent["modelSlots"]>;
    };
    if (legacy.version !== 1) {
      localStorage.setItem(LEGACY_MIGRATION_KEY, "1");
      return null;
    }
    const updates = roster.agents.flatMap((agent) => {
      if (agent.source !== "builtin") return [];
      const override = legacy.overridesByPaperoId?.[agent.id];
      const modelSlots = legacy.modelSelectionByProviderByPaperoId?.[agent.id];
      if (!override && !modelSlots) return [];
      const defaultAgent = getPaperoDefinition(agent.id as PaperoId);
      // Do not overwrite a change that already lives on the server.
      const serverChanged =
        agent.name !== defaultAgent.label ||
        agent.role !== defaultAgent.role ||
        agent.avatar !== defaultAgent.avatar ||
        agent.instructions !== defaultAgent.instructions ||
        Object.keys(agent.modelSlots).length > 0;
      if (serverChanged) return [];
      return [
        {
          ...agent,
          name: override?.name?.trim() || agent.name,
          role: override?.role?.trim() || agent.role,
          avatar: override?.avatar || agent.avatar,
          instructions: override?.instructions?.trim() || agent.instructions,
          modelSlots: modelSlots ?? agent.modelSlots,
          updatedAt: new Date().toISOString(),
        },
      ];
    });
    localStorage.setItem(LEGACY_MIGRATION_KEY, "1");
    if (updates.length === 0) return null;
    return Promise.all(
      updates.map((agent) =>
        ensureNativeApi().team.upsertAgent({ scope: { kind: "global" }, agent }),
      ),
    ).then(() => undefined);
  } catch {
    localStorage.setItem(LEGACY_MIGRATION_KEY, "1");
    return null;
  }
}

function TeamRouteView() {
  const projects = useStore((state) => state.projects);
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<TeamScope>({ kind: "global" });
  const [editing, setEditing] = useState<TeamAgent | null>(null);
  const [deleting, setDeleting] = useState<TeamAgent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ordinaryProjects = useMemo(
    () => projects.filter((project) => project.kind === "project"),
    [projects],
  );
  const rosterQuery = useQuery({
    queryKey: teamQueryKey(scope),
    queryFn: () => ensureNativeApi().team.getRoster({ scope }),
  });
  const saveAgent = useMutation({
    mutationFn: (agent: TeamAgent) => ensureNativeApi().team.upsertAgent({ scope, agent }),
    onSuccess: (roster) => {
      queryClient.setQueryData(teamQueryKey(scope), roster);
      setEditing(null);
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : "Could not save agent."),
  });
  const deleteAgent = useMutation({
    mutationFn: (agentId: string) => ensureNativeApi().team.deleteAgent({ scope, agentId }),
    onSuccess: (roster) => {
      queryClient.setQueryData(teamQueryKey(scope), roster);
      setDeleting(null);
      setEditing(null);
    },
    onError: (cause) =>
      setError(cause instanceof Error ? cause.message : "Could not delete agent."),
  });
  const agents = rosterQuery.data?.agents ?? [];
  useEffect(() => {
    if (scope.kind !== "global" || !rosterQuery.data) return;
    const migration = migrateLegacyPaperi(rosterQuery.data);
    if (migration) {
      void migration.then(() => queryClient.invalidateQueries({ queryKey: ["team", "global"] }));
    }
  }, [queryClient, rosterQuery.data, scope.kind]);

  return (
    <RouteInsetSurface>
      <main className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-y-auto px-5 py-7 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="font-heading text-2xl font-semibold">Team</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose who works on your next message.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              aria-label="Team scope"
              className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
              value={scope.kind === "global" ? "global" : scope.projectId}
              onChange={(event) => {
                setScope(
                  event.target.value === "global"
                    ? { kind: "global" }
                    : { kind: "project", projectId: event.target.value as ProjectId },
                );
              }}
            >
              <option value="global">Global</option>
              {ordinaryProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={() => {
                setError(null);
                setEditing(blankAgent());
              }}
            >
              New agent
            </Button>
          </div>
        </div>

        {rosterQuery.isError ? (
          <p className="pt-8 text-sm text-destructive">Could not load Team.</p>
        ) : (
          <div className="grid gap-3 py-6 sm:grid-cols-2 lg:grid-cols-3">
            {agents
              .filter((agent) => agent.deletedAt === null)
              .map((agent) => (
                <article
                  key={agent.id}
                  className="flex min-h-56 flex-col rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-start gap-3">
                    <img className="size-11 rounded-xl object-cover" src={agent.avatar} alt="" />
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-medium text-foreground">{agent.name}</h2>
                      <p className="truncate text-xs text-muted-foreground">{agent.role}</p>
                    </div>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                      {agent.source === "builtin" ? "Built-in" : "Custom"}
                    </span>
                  </div>
                  <p className="mt-4 line-clamp-4 text-xs leading-5 text-muted-foreground">
                    {agent.instructions}
                  </p>
                  <p className="mt-3 text-[11px] text-muted-foreground/75">
                    {Object.values(agent.modelSlots).length > 0
                      ? Object.values(agent.modelSlots)
                          .map((model) => `${model.provider}: ${model.model}`)
                          .join(" · ")
                      : "No model preset"}
                  </p>
                  <div className="mt-auto pt-4">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        setError(null);
                        setEditing(agent);
                      }}
                    >
                      Edit
                    </Button>
                  </div>
                </article>
              ))}
          </div>
        )}
      </main>

      <AgentDialog
        agent={editing}
        error={error}
        saving={saveAgent.isPending}
        onClose={() => setEditing(null)}
        onDelete={(agent) => setDeleting(agent)}
        onSave={(agent) => saveAgent.mutate({ ...agent, updatedAt: new Date().toISOString() })}
      />
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the agent from the picker. Existing messages keep its name and avatar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              variant="destructive"
              disabled={deleteAgent.isPending}
              onClick={() => deleting && deleteAgent.mutate(deleting.id)}
            >
              Delete agent
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </RouteInsetSurface>
  );
}

function AgentDialog({
  agent,
  error,
  saving,
  onClose,
  onSave,
  onDelete,
}: {
  readonly agent: TeamAgent | null;
  readonly error: string | null;
  readonly saving: boolean;
  readonly onClose: () => void;
  readonly onSave: (agent: TeamAgent) => void;
  readonly onDelete: (agent: TeamAgent) => void;
}) {
  const [draft, setDraft] = useState<TeamAgent | null>(null);
  const [avatarsOpen, setAvatarsOpen] = useState(false);
  const shown = draft && agent && draft.id === agent.id ? draft : agent;
  const update = (patch: Partial<TeamAgent>) => setDraft({ ...(shown ?? blankAgent()), ...patch });
  const close = () => {
    setDraft(null);
    setAvatarsOpen(false);
    onClose();
  };
  const resetBuiltin = () => {
    if (!shown || shown.source !== "builtin") return;
    const definition = getPaperoDefinition(shown.id as PaperoId);
    setDraft({
      ...shown,
      name: definition.label,
      role: definition.role,
      avatar: definition.avatar,
      purpose: definition.purpose,
      instructions: definition.instructions,
      modelSlots: {},
    });
  };
  return (
    <Dialog
      open={agent !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogPopup className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {shown?.source === "builtin" ? `Edit ${shown.name}` : "New agent"}
          </DialogTitle>
          <DialogDescription>Changes apply only to this Team.</DialogDescription>
        </DialogHeader>
        {shown ? (
          <DialogPanel className="space-y-5">
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <div className="flex items-center gap-3">
                <img
                  className="size-12 rounded-xl object-cover"
                  src={shown.avatar}
                  alt="Selected avatar"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">Avatar</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Choose one duck for this agent.
                  </p>
                </div>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  aria-expanded={avatarsOpen}
                  onClick={() => setAvatarsOpen((open) => !open)}
                >
                  Change
                  <DisclosureChevron open={avatarsOpen} className="size-3" />
                </Button>
              </div>
              <DisclosureRegion open={avatarsOpen} contentClassName="pt-3">
                <div className="grid max-h-43 grid-cols-7 gap-1.5 overflow-y-auto rounded-lg border border-border bg-background p-2 sm:grid-cols-8">
                  {avatarOptions().map((avatar, index) => {
                    const selected = shown.avatar === avatar;
                    return (
                      <button
                        key={avatar}
                        type="button"
                        aria-label={`Choose duck ${index + 1}`}
                        aria-pressed={selected}
                        onClick={() => {
                          update({ avatar });
                          setAvatarsOpen(false);
                        }}
                        className={
                          selected
                            ? "rounded-lg ring-2 ring-ring ring-offset-2 ring-offset-background"
                            : "rounded-lg outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                        }
                      >
                        <img className="size-10 rounded-lg object-cover" src={avatar} alt="" />
                      </button>
                    );
                  })}
                </div>
              </DisclosureRegion>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className={dialogFieldLabelClassName}>Name</span>
                <Input
                  value={shown.name}
                  maxLength={48}
                  placeholder="e.g. Frontend specialist"
                  onChange={(event) => update({ name: event.target.value })}
                />
              </label>
              <label className="grid gap-1.5">
                <span className={dialogFieldLabelClassName}>Role</span>
                <Input
                  value={shown.role}
                  maxLength={120}
                  placeholder="e.g. Builder"
                  onChange={(event) => update({ role: event.target.value })}
                />
              </label>
            </div>
            <label className="grid gap-1.5">
              <span className={dialogFieldLabelClassName}>Instructions</span>
              <span
                id="agent-instructions-help"
                className="text-xs leading-5 text-muted-foreground"
              >
                Explain how this agent should work and write. These instructions are sent with each
                message.
              </span>
              <Textarea
                className="min-h-52"
                value={shown.instructions}
                maxLength={20_000}
                placeholder="You are a focused frontend engineer. Inspect the existing component, make the smallest correct change, and explain the result briefly."
                aria-describedby="agent-instructions-help agent-instructions-count"
                onChange={(event) => update({ instructions: event.target.value })}
              />
              <span
                id="agent-instructions-count"
                className="text-right text-xs tabular-nums text-muted-foreground"
              >
                {shown.instructions.length.toLocaleString()} / 20,000
              </span>
            </label>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </DialogPanel>
        ) : null}
        <DialogFooter>
          {shown?.source === "custom" ? (
            <Button size="sm" variant="destructive-outline" onClick={() => onDelete(shown)}>
              Delete agent
            </Button>
          ) : null}
          {shown?.source === "builtin" ? (
            <Button size="sm" variant="outline" onClick={resetBuiltin}>
              Reset to default
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={close}>
            Cancel
          </Button>
          {shown ? (
            <Button
              size="sm"
              disabled={saving || !shown.name.trim() || !shown.instructions.trim()}
              onClick={() =>
                onSave({
                  ...shown,
                  name: shown.name.trim(),
                  role: shown.role.trim() || "Custom agent",
                  instructions: shown.instructions.trim(),
                })
              }
            >
              Save changes
            </Button>
          ) : null}
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

export const Route = createFileRoute("/_chat/team")({ component: TeamRouteView });
