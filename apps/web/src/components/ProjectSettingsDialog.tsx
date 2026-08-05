import { PROVIDER_DISPLAY_NAMES, type ProviderKind } from "@synara/contracts";
import { useEffect, useRef, useState } from "react";

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
import { Select, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ComposerPickerSelectPopup } from "./chat/ComposerPickerMenuPopup";

export function ProjectSettingsDialog(props: {
  open: boolean;
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
          key={`${props.initialName}:${props.provider}`}
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
  initialName: string;
  placeholder: string | undefined;
  provider: ProviderKind;
  providers: ReadonlyArray<ProviderKind>;
  onOpenChange: (open: boolean) => void;
  onSave: (value: { name: string; provider: ProviderKind }) => Promise<void> | void;
}) {
  const [name, setName] = useState(props.initialName);
  const [provider, setProvider] = useState(props.provider);
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
        {error ? (
          <p role="alert" className="text-[length:var(--app-font-size-ui-xs,10px)] text-destructive">
            {error}
          </p>
        ) : null}
      </DialogPanel>
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={() => props.onOpenChange(false)} disabled={isSaving}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => void save()} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}
