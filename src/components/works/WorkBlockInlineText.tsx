import { useEffect, useRef, type KeyboardEvent } from "react";
import { renderInlineMarkdown } from "../../markdown";

type Props = {
  text: string;
  editing: boolean;
  placeholder?: string;
  className?: string;
  onChange: (text: string) => void;
  onEnter?: () => void;
  onBackspaceEmpty?: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onSlash?: (query: string) => void;
};

function renderedHtml(text: string): string {
  return text
    .split("\n")
    .map((line) => renderInlineMarkdown(line))
    .join("<br>");
}

export function WorkBlockInlineText({
  text,
  editing,
  placeholder,
  className = "",
  onChange,
  onEnter,
  onBackspaceEmpty,
  onFocus,
  onBlur,
  onSlash,
}: Props) {
  const editableRef = useRef<HTMLDivElement | null>(null);
  const wasEditing = useRef(false);

  useEffect(() => {
    if (!editing) {
      wasEditing.current = false;
      return;
    }
    if (!editableRef.current || wasEditing.current) return;
    editableRef.current.textContent = text;
    editableRef.current.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editableRef.current);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
    wasEditing.current = true;
  }, [editing, text]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey && onEnter) {
      e.preventDefault();
      onEnter();
    }
    if (e.key === "Backspace" && onBackspaceEmpty) {
      const t = e.currentTarget.textContent ?? "";
      if (!t) {
        e.preventDefault();
        onBackspaceEmpty();
      }
    }
  };

  const onInput = (value: string) => {
    onChange(value);
    if (value.startsWith("/") && onSlash) onSlash(value.slice(1).toLowerCase());
  };

  if (!editing && text.trim()) {
    return (
      <div
        className={`work-block-editable work-block-rendered md-preview ${className}`.trim()}
        dangerouslySetInnerHTML={{ __html: renderedHtml(text) }}
        onMouseDown={(e) => {
          e.preventDefault();
          onFocus();
        }}
        tabIndex={0}
        role="textbox"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onFocus();
          }
        }}
      />
    );
  }

  return (
    <div
      ref={editableRef}
      className={`work-block-editable ${className}`.trim()}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onInput={(e) => onInput(e.currentTarget.textContent ?? "")}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
}
