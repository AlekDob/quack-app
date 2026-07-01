import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

// Voice dictation button for the composer. Wraps the browser's
// SpeechRecognition API and streams the recognised transcript back to the
// composer via onTranscript. Renders nothing when the API is unavailable
// (e.g. non-Chromium WebView) so we never show a dead control.

// Minimal typings — the DOM lib doesn't ship SpeechRecognition, and we
// only touch the handful of members we use (no `any`, per house rules).
interface SpeechRecognitionAlt {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlt;
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface ComposerMicProps {
  /** Called with each newly finalised chunk of dictated text. */
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function ComposerMic({ onTranscript, disabled }: ComposerMicProps) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  // Keep the latest callback without re-binding recognition handlers.
  const cbRef = useRef(onTranscript);
  cbRef.current = onTranscript;

  // Tear down any live session on unmount so the mic light turns off.
  useEffect(() => {
    return () => recRef.current?.stop();
  }, []);

  const ctor = getRecognitionCtor();
  if (!ctor) return null;

  const toggle = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new ctor();
    rec.lang = navigator.language || "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      // Emit only finalised results — interim text would spam the input.
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) cbRef.current(r[0].transcript.trim());
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  return (
    <button
      type="button"
      className={`ai-mic-btn ${listening ? "listening" : ""}`}
      onClick={toggle}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? "Stop dictation" : "Dictate"}
      title={listening ? "Stop dictation" : "Dictate"}
    >
      <Icon name="microphone" size={16} />
    </button>
  );
}
