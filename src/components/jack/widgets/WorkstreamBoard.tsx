import type { WorkstreamBoardData, WorkstreamItem } from './types';
import { FOCUS_COLORS } from './types';
import './JackWidgets.css';

interface Props {
  data: WorkstreamBoardData;
}

const COLUMN_ORDER: Array<{ key: string; label: string }> = [
  { key: 'current', label: 'Current' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Done' },
];

function WorkstreamCard({ item }: { item: WorkstreamItem }) {
  const color = FOCUS_COLORS[item.focus] || '#6b7280';
  return (
    <div className="ws-board-card" style={{ borderLeftColor: color }}>
      <div className="ws-board-card-title">
        <span className="ws-board-card-ws">WS{item.ws}</span>
        {item.title}
      </div>
      <div className="ws-board-card-status">{item.status}</div>
      {item.warning && (
        <div className="ws-board-card-warning">! {item.warning}</div>
      )}
    </div>
  );
}

function groupByFocus(items: WorkstreamItem[]): Map<string, WorkstreamItem[]> {
  const groups = new Map<string, WorkstreamItem[]>();
  for (const item of items) {
    const key = item.focus || 'active';
    const list = groups.get(key) || [];
    list.push(item);
    groups.set(key, list);
  }
  return groups;
}

export default function WorkstreamBoard({ data }: Props) {
  const groups = groupByFocus(data.workstreams);
  const total = data.workstreams.length;

  return (
    <div className="jack-widget">
      <div className="jack-widget-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
        <span className="jack-widget-title">Workstream Board</span>
        <span className="jack-widget-badge" style={{
          background: 'rgba(255, 107, 53, 0.15)',
          color: '#FF6B35',
        }}>{total} workstreams</span>
      </div>
      <div className="ws-board-columns">
        {COLUMN_ORDER.map(({ key, label }) => {
          const items = groups.get(key) || [];
          const color = FOCUS_COLORS[key] || '#6b7280';
          return (
            <div key={key} className="ws-board-column">
              <div className="ws-board-column-title" style={{ color }}>
                {label}
                <span className="ws-board-column-count">{items.length}</span>
              </div>
              {items.length > 0 ? (
                items.map((item) => <WorkstreamCard key={item.ws} item={item} />)
              ) : (
                <div className="ws-board-empty">Nessuno</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
