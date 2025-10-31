import { useEffect, useRef } from 'react';
import './VoiceRecordingModal.css';

interface VoiceRecordingModalProps {
  isOpen: boolean;
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  audioLevel: number;
  error: string | null;
  onClose: () => void;
  onStop: () => void;
}

export default function VoiceRecordingModal({
  isOpen,
  isListening,
  transcript,
  interimTranscript,
  audioLevel,
  error,
  onClose,
  onStop,
}: VoiceRecordingModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Animated duck wave visualization
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize canvas dimensions
    const initCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
    };

    // Duck-inspired color palette
    const duckYellow = { r: 255, g: 193, b: 7 };
    const duckOrange = { r: 255, g: 152, b: 0 };

    let time = 0;
    const waves: Array<{
      amplitude: number;
      frequency: number;
      phase: number;
      color: { r: number; g: number; b: number };
      opacity: number;
    }> = [
      {
        amplitude: 20,
        frequency: 0.02,
        phase: 0,
        color: duckYellow,
        opacity: 0.15,
      },
      {
        amplitude: 15,
        frequency: 0.025,
        phase: Math.PI / 3,
        color: duckYellow,
        opacity: 0.2,
      },
      {
        amplitude: 25,
        frequency: 0.015,
        phase: Math.PI / 2,
        color: duckOrange,
        opacity: 0.1,
      },
    ];

    const draw = () => {
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Calculate dynamic amplitude based on audio level
      const dynamicAmplitude = isListening ? 1 + (audioLevel / 100) * 2 : 0.5;

      waves.forEach((wave) => {
        ctx.beginPath();
        ctx.moveTo(0, centerY);

        // Draw smooth wave
        for (let x = 0; x < width; x += 2) {
          const y =
            centerY +
            Math.sin(x * wave.frequency + time + wave.phase) *
              wave.amplitude *
              dynamicAmplitude;
          ctx.lineTo(x, y);
        }

        // Create gradient fill
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(
          0,
          `rgba(${wave.color.r}, ${wave.color.g}, ${wave.color.b}, 0)`
        );
        gradient.addColorStop(
          0.5,
          `rgba(${wave.color.r}, ${wave.color.g}, ${wave.color.b}, ${wave.opacity})`
        );
        gradient.addColorStop(
          1,
          `rgba(${wave.color.r}, ${wave.color.g}, ${wave.color.b}, 0)`
        );

        ctx.lineTo(width, centerY);
        ctx.lineTo(0, centerY);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw wave line
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        for (let x = 0; x < width; x += 2) {
          const y =
            centerY +
            Math.sin(x * wave.frequency + time + wave.phase) *
              wave.amplitude *
              dynamicAmplitude;
          ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(${wave.color.r}, ${wave.color.g}, ${wave.color.b}, ${wave.opacity * 2})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      time += 0.05;
      animationFrameRef.current = requestAnimationFrame(draw);
    };

    // Initialize canvas with a small delay to ensure DOM is ready
    setTimeout(() => {
      initCanvas();
      draw();
    }, 50);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="voice-modal-overlay" onClick={onClose}>
      <div className="voice-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="voice-modal-header">
          <h3 className="voice-modal-title">
            {isListening ? 'Listening...' : 'Voice Input'}
          </h3>
          <button
            type="button"
            className="voice-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path
                d="M4 4l12 12M16 4L4 16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Main content - horizontal layout */}
        <div className="voice-modal-main">
          {/* Wave visualization */}
          <div className="voice-modal-visualization">
            <canvas ref={canvasRef} className="voice-wave-canvas" />

            {/* Pulsing circle indicator */}
            <div
              className={`voice-pulse-indicator ${isListening ? 'active' : ''}`}
              style={{
                transform: `scale(${1 + (audioLevel / 100) * 0.5})`,
              }}
            >
              <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
                <circle
                  cx="32"
                  cy="32"
                  r="24"
                  fill="currentColor"
                  opacity="0.2"
                />
                <path
                  d="M32 16a4 4 0 0 0-4 4v12a4 4 0 1 0 8 0V20a4 4 0 0 0-4-4Z"
                  fill="currentColor"
                />
                <path
                  d="M20 28v4a12 12 0 0 0 24 0v-4h2v4a14 14 0 0 1-13 13.95V52h6v2H25v-2h6v-6.05A14 14 0 0 1 18 32v-4h2Z"
                  fill="currentColor"
                />
              </svg>
            </div>
          </div>

          {/* Controls - side by side with visualization */}
          <div className="voice-modal-controls">
            <button
              type="button"
              className="voice-control-btn stop"
              onClick={onStop}
              disabled={!isListening}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              <span>Stop</span>
            </button>
          </div>
        </div>

        {/* Transcript display - below everything */}
        <div className="voice-modal-transcript">
          {error ? (
            <div className="voice-error">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2"/>
                <path d="M10 6v4M10 14h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span>{error}</span>
            </div>
          ) : (
            <>
              {transcript && (
                <p className="voice-transcript-final">{transcript}</p>
              )}
              {interimTranscript && (
                <p className="voice-transcript-interim">{interimTranscript}</p>
              )}
              {!transcript && !interimTranscript && !error && (
                <p className="voice-transcript-hint">
                  {isListening
                    ? 'Start speaking...'
                    : 'Ready to record'}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
