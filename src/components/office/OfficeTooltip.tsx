import type { TooltipData } from './officeTypes';

interface OfficeTooltipProps {
  data: TooltipData;
}

export default function OfficeTooltip({ data }: OfficeTooltipProps) {
  const statusLabel = data.status === 'busy' ? 'Lavorando' : 'In attesa';
  const statusClass = data.status === 'busy' ? 'status-busy' : 'status-idle';

  return (
    <div
      className="office-tooltip"
      style={{
        position: 'absolute',
        left: `${data.screenX + 30}px`,
        top: `${data.screenY - 20}px`,
        pointerEvents: 'none',
      }}
    >
      <strong className="office-tooltip-name">{data.name}</strong>
      <span className={`office-tooltip-status ${statusClass}`}>
        {statusLabel}
      </span>
      {data.workingOn && (
        <p className="office-tooltip-task">{data.workingOn}</p>
      )}
    </div>
  );
}
