import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
} from "react";
import type { WorkBlock } from "../../works";
import { toggleChecklistItem } from "../../worksBlocks";

type Props = {
  index: number;
  block: WorkBlock;
  focus?: boolean;
  onChange: (block: WorkBlock) => void;
  onEnter: () => void;
  onBackspaceEmpty: () => void;
  onSlash: (query: string) => void;
  onFocus: () => void;
};

export function WorkBlockRow({
  index,
  block,
  focus,
  onChange,
  onEnter,
  onBackspaceEmpty,
  onSlash,
  onFocus,
}: Props) {
  const editableRef = useRef<HTMLDivElement | null>(null);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!editableRef.current || focusedRef.current) return;
    editableRef.current.textContent = block.type === "paragraph" || block.type === "heading"
      ? block.text
      : "";
  }, [block]);

  useEffect(() => {
    if (!focus || !editableRef.current) return;
    editableRef.current.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editableRef.current);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [focus, block.type]);

  const onTextKey = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onEnter();
      }
      if (e.key === "Backspace") {
        const text = e.currentTarget.textContent ?? "";
        if (!text) {
          e.preventDefault();
          onBackspaceEmpty();
        }
      }
    },
    [onEnter, onBackspaceEmpty],
  );

  const onTextInput = (text: string) => {
    if (block.type === "paragraph" || block.type === "heading") {
      onChange({ ...block, text });
      if (text.startsWith("/")) onSlash(text.slice(1).toLowerCase());
    }
  };

  if (block.type === "divider") {
    return (
      <div className="work-block-row work-block-row--divider">
        <span className="work-block-grip" aria-hidden />
        <hr className="work-block-divider" />
      </div>
    );
  }

  if (block.type === "code") {
    return (
      <div className="work-block-row work-block-row--code">
        <span className="work-block-grip" aria-hidden />
        <textarea
          className="work-block-code"
          value={block.text}
          placeholder="Paste code…"
          rows={4}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          onFocus={onFocus}
        />
      </div>
    );
  }

  if (block.type === "bullet" || block.type === "ordered") {
    return (
      <ListBlockRow
        index={index}
        block={block}
        onChange={onChange}
        onFocus={onFocus}
      />
    );
  }

  if (block.type === "checklist") {
    return (
      <ChecklistBlockRow
        index={index}
        block={block}
        onChange={onChange}
        onFocus={onFocus}
      />
    );
  }

  const level =
    block.type === "heading" ? block.level : undefined;
  const placeholder =
    index === 0
      ? "Write a description, or type / for blocks…"
      : "Type / for blocks…";

  return (
    <div
      className={`work-block-row${
        level ? ` work-block-row--h${level}` : ""
      }`}
    >
      <span className="work-block-grip" aria-hidden>
        ::
      </span>
      <div
        ref={editableRef}
        className="work-block-editable"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={(e) => onTextInput(e.currentTarget.textContent ?? "")}
        onKeyDown={onTextKey}
        onFocus={() => {
          focusedRef.current = true;
          onFocus();
        }}
        onBlur={() => {
          focusedRef.current = false;
        }}
      />
    </div>
  );
}

function ListBlockRow({
  block,
  onChange,
  onFocus,
}: {
  index: number;
  block: Extract<WorkBlock, { type: "bullet" | "ordered" }>;
  onChange: (b: WorkBlock) => void;
  onFocus: () => void;
}) {
  const updateItem = (i: number, text: string) => {
    const items = block.items.map((it, idx) => (idx === i ? text : it));
    onChange({ ...block, items });
  };

  const addItem = () => onChange({ ...block, items: [...block.items, ""] });

  return (
    <div className="work-block-row work-block-row--list">
      <span className="work-block-grip" aria-hidden />
      <ul className={`work-block-list${block.type === "ordered" ? " ordered" : ""}`}>
        {block.items.map((item, i) => (
          <li key={i}>
            <div
              className="work-block-editable work-block-editable--list"
              contentEditable
              suppressContentEditableWarning
              data-placeholder="List item"
              onInput={(e) =>
                updateItem(i, e.currentTarget.textContent ?? "")
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem();
                }
              }}
              onFocus={onFocus}
            >
              {item}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChecklistBlockRow({
  block,
  onChange,
  onFocus,
}: {
  index: number;
  block: Extract<WorkBlock, { type: "checklist" }>;
  onChange: (b: WorkBlock) => void;
  onFocus: () => void;
}) {
  const toggle = (itemIdx: number) => {
    onChange(toggleChecklistItem([block], 0, itemIdx)[0]!);
  };

  const updateItem = (i: number, text: string) => {
    const items = block.items.map((it, idx) =>
      idx === i ? { ...it, text } : it,
    );
    onChange({ ...block, items });
  };

  const addItem = () => {
    onChange({
      ...block,
      items: [...block.items, { text: "", done: false }],
    });
  };

  return (
    <div className="work-block-row work-block-row--checklist">
      <span className="work-block-grip" aria-hidden />
      <ul className="work-block-checklist">
        {block.items.map((item, i) => (
          <li key={i}>
            <button
              type="button"
              className={`work-block-check${item.done ? " done" : ""}`}
              aria-label={item.done ? "Mark undone" : "Mark done"}
              onClick={() => toggle(i)}
            >
              {item.done ? <span className="work-block-check-mark" /> : null}
            </button>
            <div
              className={`work-block-editable work-block-editable--list${
                item.done ? " done" : ""
              }`}
              contentEditable
              suppressContentEditableWarning
              data-placeholder="To-do"
              onInput={(e) =>
                updateItem(i, e.currentTarget.textContent ?? "")
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem();
                }
              }}
              onFocus={onFocus}
            >
              {item.text}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
