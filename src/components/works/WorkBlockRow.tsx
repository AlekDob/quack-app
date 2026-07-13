import { useCallback } from "react";
import type { WorkBlock } from "../../works";
import { toggleChecklistItem } from "../../worksBlocks";
import { WorkBlockInlineText } from "./WorkBlockInlineText";

type Props = {
  index: number;
  block: WorkBlock;
  focus?: boolean;
  onChange: (block: WorkBlock) => void;
  onEnter: () => void;
  onBackspaceEmpty: () => void;
  onSlash: (query: string) => void;
  onFocus: () => void;
  onBlur: () => void;
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
  onBlur,
}: Props) {
  const editing = !!focus;

  const onTextChange = useCallback(
    (text: string) => {
      if (block.type === "paragraph" || block.type === "heading") {
        onChange({ ...block, text });
      }
    },
    [block, onChange],
  );

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
        block={block}
        editing={editing}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    );
  }

  if (block.type === "checklist") {
    return (
      <ChecklistBlockRow
        block={block}
        editing={editing}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    );
  }

  const level = block.type === "heading" ? block.level : undefined;
  const placeholder =
    index === 0
      ? "Write a description, or type / for blocks…"
      : "Type / for blocks…";
  const text = block.text;

  return (
    <div
      className={`work-block-row${level ? ` work-block-row--h${level}` : ""}`}
    >
      <span className="work-block-grip" aria-hidden>
        ::
      </span>
      <WorkBlockInlineText
        text={text}
        editing={editing}
        placeholder={placeholder}
        onChange={onTextChange}
        onEnter={onEnter}
        onBackspaceEmpty={onBackspaceEmpty}
        onSlash={onSlash}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </div>
  );
}

function ListBlockRow({
  block,
  editing,
  onChange,
  onFocus,
  onBlur,
}: {
  block: Extract<WorkBlock, { type: "bullet" | "ordered" }>;
  editing: boolean;
  onChange: (b: WorkBlock) => void;
  onFocus: () => void;
  onBlur: () => void;
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
            <WorkBlockInlineText
              text={item}
              editing={editing}
              className="work-block-editable--list"
              placeholder="List item"
              onChange={(text) => updateItem(i, text)}
              onEnter={addItem}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChecklistBlockRow({
  block,
  editing,
  onChange,
  onFocus,
  onBlur,
}: {
  block: Extract<WorkBlock, { type: "checklist" }>;
  editing: boolean;
  onChange: (b: WorkBlock) => void;
  onFocus: () => void;
  onBlur: () => void;
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
            <WorkBlockInlineText
              text={item.text}
              editing={editing}
              className={`work-block-editable--list${item.done ? " done" : ""}`}
              placeholder="To-do"
              onChange={(text) => updateItem(i, text)}
              onEnter={addItem}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
