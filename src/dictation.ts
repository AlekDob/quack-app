import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type DictationEngine = "native" | "web";

interface SpeechRecognitionAlt {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlt;
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
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

export interface DictationCallbacks {
  onPartial: (text: string) => void;
  onError: (message: string) => void;
}

export interface DictationSession {
  stop(): Promise<string>;
  cancel(): void;
}

function webSpeechCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function inTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export async function dictationEngine(): Promise<DictationEngine | null> {
  if (inTauri()) {
    try {
      const ok = await invoke<boolean>("dictation_available");
      if (ok) return "native";
    } catch {
      /* fall through */
    }
  }
  return webSpeechCtor() ? "web" : null;
}

export async function startDictation(
  cb: DictationCallbacks,
): Promise<DictationSession> {
  const engine = await dictationEngine();
  if (engine === "native") return startNative(cb);
  if (engine === "web") return startWeb(cb);
  throw new Error("Voice dictation is not available on this platform");
}

async function startNative(cb: DictationCallbacks): Promise<DictationSession> {
  let transcript = "";
  const unsubs: UnlistenFn[] = [];
  const off = async () => {
    for (const u of unsubs) u();
    unsubs.length = 0;
  };

  unsubs.push(
    await listen<{ text: string }>("dictation-partial", (e) => {
      transcript = e.payload.text;
      cb.onPartial(transcript);
    }),
  );
  unsubs.push(
    await listen<{ text: string }>("dictation-final", (e) => {
      transcript = e.payload.text;
      cb.onPartial(transcript);
    }),
  );
  unsubs.push(
    await listen<{ text: string }>("dictation-error", (e) => {
      cb.onError(e.payload.text);
    }),
  );

  await invoke("dictation_start");

  return {
    async stop() {
      await off();
      return invoke<string>("dictation_stop");
    },
    cancel() {
      void off();
      void invoke("dictation_cancel");
    },
  };
}

function startWeb(cb: DictationCallbacks): DictationSession {
  const ctor = webSpeechCtor();
  if (!ctor) throw new Error("Web Speech API unavailable");

  let transcript = "";
  const rec = new ctor();
  rec.lang = navigator.language || "en-US";
  rec.continuous = true;
  rec.interimResults = true;
  rec.onresult = (e) => {
    let chunk = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      chunk += e.results[i][0].transcript;
    }
    transcript = chunk.trim();
    if (transcript) cb.onPartial(transcript);
  };
  rec.onerror = () => cb.onError("dictation failed");
  rec.start();

  return {
    async stop() {
      rec.stop();
      return transcript;
    },
    cancel() {
      transcript = "";
      rec.stop();
    },
  };
}

/** Live mic levels for the waveform — best-effort, non-blocking. */
export async function openAudioMeter(
  onLevel: (level: number) => void,
): Promise<() => void> {
  if (!navigator.mediaDevices?.getUserMedia) return () => {};

  let stream: MediaStream | null = null;
  let raf = 0;
  let closed = false;

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    src.connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      if (closed) return;
      analyser.getByteFrequencyData(buf);
      let sum = 0;
      for (const v of buf) sum += v;
      onLevel(sum / buf.length / 255);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      closed = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      void ctx.close();
    };
  } catch {
    stream?.getTracks().forEach((t) => t.stop());
    return () => {};
  }
}

export function formatDictationTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
