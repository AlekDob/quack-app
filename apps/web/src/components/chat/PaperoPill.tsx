// FILE: PaperoPill.tsx
// Purpose: Composer pill to pick Jack / Milo / Nora / Vera / Lia. Selecting an agent
//          is a normal menu row; a discreet book icon opens instructions to the right on hover.
// Layer: Chat composer presentation

import type { ModelSelection, ProviderKind } from "@synara/contracts";
import {
  getPaperoDefinition,
  listComposerPaperi,
  type PaperoDefinition,
  type PaperoId,
} from "@synara/shared/paperi";
import { useEffect, useState } from "react";

import { CheckIcon, ChevronRightIcon, FileIcon, SettingsIcon } from "~/lib/icons";
import { cn } from "~/lib/utils";
import { paperoSlotProviders, usePaperoStore } from "~/paperi";
import { Button } from "../ui/button";
import { DisclosureChevron } from "../ui/DisclosureChevron";
import { DisclosureRegion } from "../ui/DisclosureRegion";
import { Menu, MenuItem, MenuSeparator, MenuSub, MenuSubTrigger, MenuTrigger } from "../ui/menu";
import { Textarea } from "../ui/textarea";
import { ComposerPickerMenuPopup, ComposerPickerMenuSubPopup } from "./ComposerPickerMenuPopup";
import { PickerTriggerButton } from "./PickerTriggerButton";
import { COMPOSER_PICKER_TRIGGER_TEXT_CLASS_NAME } from "./composerPickerStyles";

export function PaperoAvatar({
  definition,
  className,
}: {
  readonly definition: PaperoDefinition;
  readonly className?: string;
}) {
  return (
    <img
      src={definition.avatar}
      alt=""
      aria-hidden="true"
      className={cn("size-3.5 rounded-full object-cover", className)}
    />
  );
}

function PaperoInstructionsPanel(props: {
  readonly paperoId: PaperoId;
  readonly onSaveInstructions: (paperoId: PaperoId, instructions: string) => void;
  readonly onResetInstructions: (paperoId: PaperoId) => void;
}) {
  const resolveEffectiveDefinition = usePaperoStore((store) => store.resolveEffectiveDefinition);
  const overrides = usePaperoStore((store) => store.overridesByPaperoId[props.paperoId]);
  const definition = resolveEffectiveDefinition(props.paperoId);
  const builtinInstructions = getPaperoDefinition(props.paperoId).instructions;
  const [draft, setDraft] = useState(definition.instructions);
  const hasCustom = Boolean(overrides?.instructions?.trim());
  const dirty = draft.trim() !== definition.instructions.trim();
  const canReset = hasCustom || draft.trim() !== builtinInstructions.trim();

  useEffect(() => {
    setDraft(definition.instructions);
  }, [definition.instructions, props.paperoId]);

  return (
    <div
      className="flex w-72 flex-col gap-2 p-2"
      onKeyDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center gap-1.5">
        <FileIcon className="size-3.5 shrink-0 opacity-70" strokeWidth={1.75} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-[length:var(--app-font-size-ui-sm,11px)] font-medium">
          Instructions · {definition.label}
          {hasCustom ? (
            <span className="font-normal text-[var(--color-text-foreground-secondary)]">
              {" "}
              · edited
            </span>
          ) : null}
        </span>
      </div>
      <p className="text-[length:var(--app-font-size-ui-sm,11px)] leading-snug text-[var(--color-text-foreground-secondary)]">
        {definition.purpose}
      </p>
      <Textarea
        size="sm"
        unstyled
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className="max-h-48 min-h-28 overflow-y-auto rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-background-elevated)] text-[length:var(--app-font-size-ui-sm,11px)]"
        aria-label={`Instructions for ${definition.label}`}
      />
      <div className="flex items-center justify-end gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-[length:var(--app-font-size-ui-sm,11px)]"
          disabled={!canReset}
          onClick={() => {
            setDraft(builtinInstructions);
            props.onResetInstructions(props.paperoId);
          }}
        >
          Reset
        </Button>
        <Button
          type="button"
          size="sm"
          variant="chrome"
          className="h-7 px-2 text-[length:var(--app-font-size-ui-sm,11px)]"
          disabled={!dirty || draft.trim().length === 0}
          onClick={() => {
            props.onSaveInstructions(props.paperoId, draft.trim());
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

export function PaperoPill(props: {
  readonly activePaperoId: PaperoId;
  readonly activeDefinition: PaperoDefinition;
  readonly currentProvider: ProviderKind;
  readonly modelSelectionByProvider: Partial<Record<ProviderKind, ModelSelection>>;
  readonly compact?: boolean;
  /** Hide the role subtitle; keep avatar + name (narrow composer). */
  readonly hideRole?: boolean;
  readonly hideLabel?: boolean;
  readonly disabled?: boolean;
  readonly onSelectPapero: (paperoId: PaperoId) => void;
  readonly onSaveCurrentModelSlot: () => void;
  readonly onClearModelSlot: (provider: ProviderKind) => void;
  readonly onSaveInstructions: (paperoId: PaperoId, instructions: string) => void;
  readonly onResetInstructions: (paperoId: PaperoId) => void;
}) {
  const [open, setOpen] = useState(false);
  const [slotsOpen, setSlotsOpen] = useState(false);
  const paperi = listComposerPaperi();
  const savedProviders = paperoSlotProviders(props.modelSelectionByProvider);
  const hasSlotForCurrent = savedProviders.includes(props.currentProvider);

  const roleLabel =
    props.activeDefinition.role.split("·")[0]?.trim() ?? props.activeDefinition.role;
  const label = props.hideRole ? (
    <span className="truncate">{props.activeDefinition.label}</span>
  ) : (
    <span className="inline-flex min-w-0 items-center gap-1">
      <span className="truncate">{props.activeDefinition.label}</span>
      <span className="truncate text-[var(--color-text-foreground-secondary)]">· {roleLabel}</span>
    </span>
  );

  const triggerButton = (
    <PickerTriggerButton
      {...(props.compact !== undefined ? { compact: props.compact } : {})}
      {...(props.hideLabel !== undefined ? { hideLabel: props.hideLabel } : {})}
      {...(props.disabled !== undefined ? { disabled: props.disabled } : {})}
      icon={<PaperoAvatar definition={props.activeDefinition} />}
      label={label}
      className={cn(
        COMPOSER_PICKER_TRIGGER_TEXT_CLASS_NAME,
        props.hideRole ? "max-w-28" : "max-w-44",
      )}
      aria-label={`Papero: ${props.activeDefinition.label}`}
      title={`${props.activeDefinition.label} · ${props.activeDefinition.role}`}
    />
  );

  return (
    <Menu
      keepOpenOnSubmenuInteraction
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setSlotsOpen(false);
        }
      }}
    >
      <MenuTrigger render={triggerButton} />
      <ComposerPickerMenuPopup align="start" side="top" className="min-w-56 max-w-72 p-1">
        {paperi.map((definition) => {
          const selected = definition.id === props.activePaperoId;
          return (
            <div key={definition.id} className="flex items-center gap-0.5">
              <MenuItem
                className="min-w-0 flex-1 gap-2"
                onClick={() => {
                  props.onSelectPapero(definition.id);
                }}
              >
                <PaperoAvatar definition={definition} className="size-4" />
                <span className="min-w-0 flex-1 truncate text-left">
                  <span className="block truncate font-medium">{definition.label}</span>
                  <span className="block truncate text-[length:var(--app-font-size-ui-sm,11px)] text-[var(--color-text-foreground-secondary)]">
                    {definition.role}
                  </span>
                </span>
                {selected ? <CheckIcon className="size-3.5 shrink-0 opacity-80" /> : null}
              </MenuItem>
              <MenuSub>
                <MenuSubTrigger
                  aria-label={`Instructions for ${definition.label}`}
                  className={cn(
                    "size-5 shrink-0 justify-center gap-0 rounded-sm p-0",
                    "text-[var(--color-text-foreground-secondary)]",
                    "hover:bg-transparent hover:text-[var(--color-text-foreground)]",
                    "data-popup-open:bg-transparent data-popup-open:text-[var(--color-text-foreground)]",
                    // Hide default MenuSubTrigger chevron; we render a smaller one.
                    "[&>svg:last-child]:hidden",
                    "[&>svg:first-child]:opacity-65 hover:[&>svg:first-child]:opacity-90",
                    "data-popup-open:[&>svg:first-child]:opacity-95",
                  )}
                >
                  <ChevronRightIcon aria-hidden="true" strokeWidth={1.75} className="size-3" />
                </MenuSubTrigger>
                <ComposerPickerMenuSubPopup className="p-0">
                  <PaperoInstructionsPanel
                    paperoId={definition.id}
                    onSaveInstructions={props.onSaveInstructions}
                    onResetInstructions={props.onResetInstructions}
                  />
                </ComposerPickerMenuSubPopup>
              </MenuSub>
            </div>
          );
        })}
        <MenuSeparator />
        <MenuItem
          className="gap-2"
          onClick={() => {
            props.onSaveCurrentModelSlot();
          }}
        >
          <SettingsIcon className="size-3.5 shrink-0 opacity-70" />
          <span className="min-w-0 flex-1 truncate text-left">
            {hasSlotForCurrent
              ? `Update ${props.currentProvider} slot`
              : `Save current model for ${props.currentProvider}`}
          </span>
        </MenuItem>
        {savedProviders.length > 0 ? (
          <>
            <MenuItem
              className="gap-2"
              closeOnClick={false}
              aria-expanded={slotsOpen}
              onClick={() => {
                setSlotsOpen((value) => !value);
              }}
            >
              <span className="min-w-0 flex-1 truncate text-left text-[var(--color-text-foreground-secondary)]">
                Saved slots ({savedProviders.length})
              </span>
              <DisclosureChevron open={slotsOpen} className="size-3 opacity-70" />
            </MenuItem>
            <DisclosureRegion open={slotsOpen} contentClassName="px-1 pb-1">
              {savedProviders.map((provider) => {
                const slot = props.modelSelectionByProvider[provider];
                if (!slot) return null;
                return (
                  <div
                    key={provider}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[length:var(--app-font-size-ui-sm,11px)]"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{provider}</span>
                      <span className="text-[var(--color-text-foreground-secondary)]">
                        {" "}
                        · {slot.model}
                      </span>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 shrink-0 px-1.5 text-[length:var(--app-font-size-ui-sm,11px)]"
                      onClick={() => props.onClearModelSlot(provider)}
                    >
                      Clear
                    </Button>
                  </div>
                );
              })}
            </DisclosureRegion>
          </>
        ) : null}
      </ComposerPickerMenuPopup>
    </Menu>
  );
}
