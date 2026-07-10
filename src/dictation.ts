import { invoke } from "@tauri-apps/api/core";

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
  onLevel?: (level: number) => void;
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
  await invoke("dictation_request_auth");
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(stream);
  const chunks: Float32Array[] = [];
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  let meterRaf = 0;
  let meterClosed = false;

  if (cb.onLevel) {
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    src.connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      if (meterClosed) return;
      analyser.getByteFrequencyData(buf);
      let sum = 0;
      for (const v of buf) sum += v;
      cb.onLevel!(sum / buf.length / 255);
      meterRaf = requestAnimationFrame(tick);
    };
    tick();
  }

  processor.onaudioprocess = (e) => {
    chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  };
  src.connect(processor);
  processor.connect(ctx.destination);

  const teardown = () => {
    meterClosed = true;
    cancelAnimationFrame(meterRaf);
    processor.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
  };

  return {
    async stop() {
      const sampleRate = ctx.sampleRate;
      teardown();
      const merged = mergeFloat32(chunks);
      const wav = encodeWav(merged, sampleRate);
      return invoke<string>("dictation_transcribe_wav", { wav: [...wav] });
    },
    cancel() {
      teardown();
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

  let stopMeter = () => {};
  if (cb.onLevel) {
    void openAudioMeter(cb.onLevel).then((stop) => {
      stopMeter = stop;
    });
  }

  return {
    async stop() {
      rec.stop();
      stopMeter();
      return transcript;
    },
    cancel() {
      transcript = "";
      rec.stop();
      stopMeter();
    },
  };
}

function mergeFloat32(chunks: Float32Array[]): Float32Array {
  const len = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Float32Array(len);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const numSamples = samples.length;
  const bytes = 44 + numSamples * 2;
  const buffer = new ArrayBuffer(bytes);
  const view = new DataView(buffer);
  writeWavHeader(view, numSamples, sampleRate);
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Uint8Array(buffer);
}

function writeWavHeader(view: DataView, numSamples: number, sampleRate: number) {
  const byteRate = sampleRate * 2;
  const blockAlign = 2;
  const dataSize = numSamples * 2;
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
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
