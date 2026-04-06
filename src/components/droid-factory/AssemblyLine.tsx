import { useState, useEffect } from 'react';

// Assembly phases with technical labels (no emojis)
const ASSEMBLY_PHASES = [
  { label: 'BLUEPRINT', message: 'Generating specifications...' },
  { label: 'ASSEMBLY', message: 'Installing protocol chips...' },
  { label: 'ACTIVATION', message: 'Calibrating personality matrix...' },
  { label: 'DEPLOYMENT', message: 'Deploying droid...' },
];

// SVG icons for each phase - 24px icons (grey when inactive, orange when active)
const PHASE_ICONS = [
  // Blueprint
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2" strokeDasharray="2 2" />
    <line x1="8" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="8" y1="12" x2="14" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="8" y1="15" x2="12" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>,
  // Assembly
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
    <path d="M12 4V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
  // Activation
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="2" />
    <circle cx="10" cy="11" r="1.5" fill="currentColor" />
    <circle cx="14" cy="11" r="1.5" fill="currentColor" />
    <path d="M9 14C9 14 10 15 12 15C14 15 15 14 15 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>,
  // Deployment
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L4 7V12C4 16.5 7.5 20.5 12 21.5C16.5 20.5 20 16.5 20 12V7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
];

export function AssemblyLine() {
  const [currentPhase, setCurrentPhase] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Simulate assembly progress
    const phaseInterval = setInterval(() => {
      setCurrentPhase((prev) => {
        if (prev < ASSEMBLY_PHASES.length - 1) {
          return prev + 1;
        }
        clearInterval(phaseInterval);
        return prev;
      });
    }, 500);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 2;
      });
    }, 40);

    return () => {
      clearInterval(phaseInterval);
      clearInterval(progressInterval);
    };
  }, []);

  return (
    <div
      className="absolute bottom-0 left-0 right-0 p-2"
      style={{
        background: '#101015',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      <div className="space-y-2">
        {/* Assembly Stations - Compact */}
        <div className="flex items-center justify-center gap-4">
          {ASSEMBLY_PHASES.map((phase, index) => (
            <div
              key={phase.label}
              className="text-center transition-all duration-500"
              style={{
                opacity: index <= currentPhase ? 1 : 0.3,
                transform: index === currentPhase ? 'scale(1.05)' : 'scale(1)',
              }}
            >
              <div
                className="mb-1 flex justify-center"
                style={{
                  color: index === currentPhase ? 'var(--accent-color)' : 'rgba(255, 255, 255, 0.3)',
                  filter: index === currentPhase ? 'drop-shadow(0 0 8px rgba(var(--accent-rgb), 0.60))' : 'none',
                }}
              >
                {PHASE_ICONS[index]}
              </div>
              <div
                className="text-[10px] font-bold tracking-wider font-mono"
                style={{
                  color: index === currentPhase ? '#ffffff' : 'rgba(255, 255, 255, 0.4)',
                }}
              >
                {phase.label}
              </div>
              {index === currentPhase && (
                <div
                  className="mt-0.5 w-10 h-0.5 mx-auto"
                  style={{
                    background: 'var(--accent-color)',
                    boxShadow: '0 0 6px rgba(var(--accent-rgb), 0.60)',
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Progress Message - Compact */}
        <p
          className="text-[11px] text-center font-medium"
          style={{
            color: 'rgba(255, 255, 255, 0.7)',
            minHeight: '16px',
          }}
        >
          {ASSEMBLY_PHASES[currentPhase]?.message}
        </p>

        {/* Progress Bar - Compact */}
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div
            className="h-full rounded-full transition-all duration-200"
            style={{
              width: `${progress}%`,
              background: 'var(--accent-color)',
              boxShadow: '0 0 8px rgba(var(--accent-rgb), 0.50)',
            }}
          />
        </div>

        {/* Progress Percentage - Compact */}
        <div className="text-center">
          <span
            className="text-[10px] font-mono font-semibold"
            style={{ color: 'rgba(255, 255, 255, 0.6)' }}
          >
            {progress}%
          </span>
        </div>
      </div>
    </div>
  );
}
