import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import {
  dictationEngine,
  formatDictationTime,
  startDictation,
  type DictationSession,
} from "../dictation";

interface ComposerMicProps {
  onStart: () => void;
  disabled?: boolean;
}

/** Toolbar mic button — opens Cursor-style dictation in the input row. */
export function ComposerMic({ onStart, disabled }: ComposerMicProps) {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    void dictationEngine().then((e) => setAvailable(e !== null));
  }, []);

  if (available === false) return null;

  return (
    <button
      type="button"
      className="ai-mic-btn"
      onClick={onStart}
      disabled={disabled}
      aria-label="Dictate"
      title="Dictate"
    >
      <Icon name="microphone" size={16} />
    </button>
  );
}

interface ComposerDictationBarProps {
  onConfirm: (text: string) => void;
  onCancel: () => void;
}

const WAVE_BARS = 28;

/** Cursor-style recording row: waveform, timer, cancel, confirm. */
export function ComposerDictationBar({
  onConfirm,
  onCancel,
}: ComposerDictationBarProps) {
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>(() =>
    Array.from({ length: WAVE_BARS }, () => 0.08),
  );
  const [preview, setPreview] = useState("");
  const sessionRef = useRef<DictationSession | null>(null);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    let alive = true;
    const tick = window.setInterval(() => {
      if (alive) setElapsed(Date.now() - startedAt.current);
    }, 200);

    void (async () => {
      try {
        const session = await startDictation({
          onPartial: (text) => {
            if (alive) setPreview(text);
          },
          onError: () => {
            if (alive) onCancel();
          },
          onLevel: (level) => {
            if (!alive) return;
            setLevels((prev) => {
              const next = prev.slice(1);
              next.push(Math.max(0.06, level));
              return next;
            });
          },
        });
        if (!alive) {
          session.cancel();
          return;
        }
        sessionRef.current = session;
      } catch {
        if (alive) onCancel();
      }
    })();

    return () => {
      alive = false;
      clearInterval(tick);
      sessionRef.current?.cancel();
      sessionRef.current = null;
    };
  }, [onCancel]);

  const confirm = () => {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (!session) {
      onCancel();
      return;
    }
    void session.stop().then(
      (text) => onConfirm(text.trim()),
      () => onCancel(),
    );
  };

  const cancel = () => {
    sessionRef.current?.cancel();
    sessionRef.current = null;
    onCancel();
  };

  return (
    <div className="ai-dictation-bar" role="region" aria-label="Voice dictation">
      <div className="ai-dictation-wave" aria-hidden>
        {levels.map((lv, i) => (
          <span
            key={i}
            className="ai-dictation-wave-bar"
            style={{ "--lv": String(lv) } as React.CSSProperties}
          />
        ))}
      </div>
      <span className="ai-dictation-timer">{formatDictationTime(elapsed)}</span>
      {preview ? (
        <span className="ai-dictation-preview" title={preview}>
          {preview}
        </span>
      ) : null}
      <button
        type="button"
        className="ai-dictation-btn"
        onClick={cancel}
        aria-label="Cancel dictation"
        title="Cancel"
      >
        <Icon name="x" size={14} />
      </button>
      <button
        type="button"
        className="ai-dictation-btn ai-dictation-confirm"
        onClick={confirm}
        aria-label="Insert dictation"
        title="Insert"
      >
        <Icon name="check" size={14} />
      </button>
    </div>
  );
}
