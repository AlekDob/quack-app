import type { SlashCommand } from "../../workBlockEditor";

type Props = {
  commands: SlashCommand[];
  active: number;
  onPick: (id: string) => void;
  onHover: (idx: number) => void;
};

export function WorkBlockSlashMenu({
  commands,
  active,
  onPick,
  onHover,
}: Props) {
  if (commands.length === 0) return null;
  return (
    <div className="work-slash-menu" role="listbox">
      <div className="work-slash-menu-title">Blocks</div>
      {commands.map((cmd, i) => (
        <button
          key={cmd.id}
          type="button"
          role="option"
          aria-selected={i === active}
          className={`work-slash-item${i === active ? " active" : ""}`}
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(cmd.id);
          }}
          onMouseEnter={() => onHover(i)}
        >
          <span className="work-slash-glyph">{cmd.glyph}</span>
          <span className="work-slash-labels">
            <span className="work-slash-label">{cmd.label}</span>
            <span className="work-slash-hint">{cmd.hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
