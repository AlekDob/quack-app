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

/** Begin mic capture on the user-gesture stack (required for WKWebView). */
export interface DictationCapture {
  attach(cb: DictationCallbacks): DictationSession;
  dispose(): void;
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

/** Call synchronously from the mic click handler — do not await before this. */
export function beginDictationCapture(): Promise<DictationCapture> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return Promise.reject(new Error("Microphone unavailable"));
  }
  const streamPromise = navigator.mediaDevices.getUserMedia({ audio: true });
  return finishCaptureSetup(streamPromise);
}

async function finishCaptureSetup(
  streamPromise: Promise<MediaStream>,
): Promise<DictationCapture> {
  const engine = await dictationEngine();
  const stream = await streamPromise;
  if (engine === "native") {
    await invoke("dictation_request_auth");
    return buildNativeCapture(stream);
  }
  if (engine === "web") return buildWebCapture(stream);
  stream.getTracks().forEach((t) => t.stop());
  throw new Error("Voice dictation is not available on this platform");
}

export async function startDictation(
  cb: DictationCallbacks,
): Promise<DictationSession> {
  const capture = await beginDictationCapture();
  return capture.attach(cb);
}

function buildNativeCapture(stream: MediaStream): DictationCapture {
  const ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  src.connect(analyser);
  const meterBuf = new Uint8Array(analyser.fftSize);
  const blobs: Blob[] = [];
  const mime = pickRecorderMime();
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) blobs.push(e.data);
  };
  recorder.start(200);
  const ready = ctx.resume();

  let meterRaf = 0;
  let meterCb: ((level: number) => void) | null = null;
  let meterClosed = false;

  const tickMeter = () => {
    if (meterClosed || !meterCb) return;
    analyser.getByteTimeDomainData(meterBuf);
    let peak = 0;
    for (const v of meterBuf) {
      const amp = Math.abs(v - 128) / 128;
      if (amp > peak) peak = amp;
    }
    meterCb(Math.min(1, peak * 2.2));
    meterRaf = requestAnimationFrame(tickMeter);
  };

  const teardown = () => {
    meterClosed = true;
    cancelAnimationFrame(meterRaf);
    if (recorder.state !== "inactive") recorder.stop();
    stream.getTracks().forEach((t) => t.stop());
    src.disconnect();
    analyser.disconnect();
    void ctx.close();
  };

  const stopRecorder = () =>
    new Promise<Blob>((resolve) => {
      if (recorder.state === "inactive") {
        resolve(new Blob(blobs, { type: recorder.mimeType }));
        return;
      }
      recorder.onstop = () => {
        resolve(new Blob(blobs, { type: recorder.mimeType }));
      };
      recorder.stop();
    });

  return {
    attach(cb) {
      meterCb = cb.onLevel ?? null;
      void ready.then(() => {
        if (meterCb && !meterClosed) tickMeter();
      });
      return {
        async stop() {
          const blob = await stopRecorder();
          teardown();
          const wav = await blobToWav(blob);
          const text = await invoke<string>("dictation_transcribe_wav", {
            wav: [...wav],
          });
          if (!text.trim()) throw new Error("No speech detected");
          return text;
        },
        cancel() {
          teardown();
        },
      };
    },
    dispose() {
      teardown();
    },
  };
}

function buildWebCapture(stream: MediaStream): DictationCapture {
  const ctor = webSpeechCtor();
  if (!ctor) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error("Web Speech API unavailable");
  }

  let transcript = "";
  let rec: SpeechRecognitionLike | null = null;
  let stopMeter = () => {};

  const teardown = () => {
    rec?.stop();
    rec = null;
    stopMeter();
    stream.getTracks().forEach((t) => t.stop());
  };

  return {
    attach(cb) {
      rec = new ctor();
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
      if (cb.onLevel) {
        void openAudioMeter(cb.onLevel, stream).then((stop) => {
          stopMeter = stop;
        });
      }
      return {
        async stop() {
          rec?.stop();
          stopMeter();
          stream.getTracks().forEach((t) => t.stop());
          return transcript;
        },
        cancel() {
          transcript = "";
          teardown();
        },
      };
    },
    dispose() {
      teardown();
    },
  };
}

function pickRecorderMime(): string | undefined {
  for (const t of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

async function blobToWav(blob: Blob): Promise<Uint8Array> {
  if (blob.size < 64) throw new Error("No speech detected");
  const decodeCtx = new AudioContext();
  await decodeCtx.resume();
  const decoded = await decodeCtx.decodeAudioData(await blob.arrayBuffer());
  const wav = encodeWav(decoded.getChannelData(0), decoded.sampleRate);
  await decodeCtx.close();
  return wav;
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
  const dataSize = numSamples * 2;
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

/** Live mic levels — pass an existing stream to avoid a second getUserMedia. */
export async function openAudioMeter(
  onLevel: (level: number) => void,
  existing?: MediaStream,
): Promise<() => void> {
  if (!navigator.mediaDevices?.getUserMedia && !existing) return () => {};

  let stream: MediaStream | null = existing ?? null;
  let raf = 0;
  let closed = false;

  try {
    if (!stream) stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx = new AudioContext();
    await ctx.resume();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);

    const tick = () => {
      if (closed) return;
      analyser.getByteTimeDomainData(buf);
      let peak = 0;
      for (const v of buf) {
        const amp = Math.abs(v - 128) / 128;
        if (amp > peak) peak = amp;
      }
      onLevel(Math.min(1, peak * 2.2));
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      closed = true;
      cancelAnimationFrame(raf);
      if (!existing) stream?.getTracks().forEach((t) => t.stop());
      src.disconnect();
      void ctx.close();
    };
  } catch {
    if (!existing) stream?.getTracks().forEach((t) => t.stop());
    return () => {};
  }
}

export function formatDictationTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
