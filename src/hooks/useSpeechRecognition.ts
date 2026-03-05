import { useState, useEffect, useRef, useCallback } from 'react';

// Type definitions for Web Speech API
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onaudioend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onnomatch: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
}

interface SpeechRecognitionConstructor {
  new(): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  audioLevel: number; // 0-100 for visualization
}

// Check if browser supports Speech Recognition
const getSpeechRecognition = (): SpeechRecognitionConstructor | null => {
  if (typeof window === 'undefined') return null;

  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const {
    lang = 'it-IT', // Default to Italian
    continuous = true,
    interimResults = true,
    maxAlternatives = 1,
    onResult,
    onError,
    onEnd,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const SpeechRecognitionClass = getSpeechRecognition();
  const isSupported = SpeechRecognitionClass !== null;

  // Initialize audio visualization
  const initAudioVisualization = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      microphone.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Start animation loop for audio level
      const updateAudioLevel = () => {
        if (!analyserRef.current) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average audio level
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const normalized = Math.min(100, (average / 128) * 100);

        setAudioLevel(normalized);
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };

      updateAudioLevel();
    } catch (err) {
      console.error('Failed to initialize audio visualization:', err);
    }
  }, []);

  // Cleanup audio visualization
  const cleanupAudioVisualization = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  // Initialize Speech Recognition
  useEffect(() => {
    if (!isSupported || !SpeechRecognitionClass) return;

    const recognition = new SpeechRecognitionClass();
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.maxAlternatives = maxAlternatives;

    recognition.onstart = () => {
      console.log('[SpeechRecognition] Started');
      setIsListening(true);
      setError(null);
      void initAudioVisualization();
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      console.log('[SpeechRecognition] Got result:', event);
      let finalTranscript = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptPiece = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += transcriptPiece + ' ';
        } else {
          interimText += transcriptPiece;
        }
      }

      console.log('[SpeechRecognition] Final:', finalTranscript, 'Interim:', interimText);

      if (finalTranscript) {
        setTranscript((prev) => prev + finalTranscript);
        setInterimTranscript('');
        if (onResult) {
          onResult(finalTranscript.trim(), true);
        }
      } else if (interimText) {
        setInterimTranscript(interimText);
        if (onResult) {
          onResult(interimText, false);
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      let errorMessage = 'Speech recognition error';

      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected. Please try again.';
          break;
        case 'audio-capture':
          errorMessage = 'No microphone found. Please check your audio settings.';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone permission denied. Please allow microphone access.';
          break;
        case 'network':
          errorMessage = 'Network error. Please check your internet connection.';
          break;
        case 'aborted':
          // User stopped - not an error
          return;
        default:
          errorMessage = `Speech recognition error: ${event.error}`;
      }

      setError(errorMessage);
      setIsListening(false);
      cleanupAudioVisualization();

      if (onError) {
        onError(errorMessage);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      cleanupAudioVisualization();

      if (onEnd) {
        onEnd();
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      cleanupAudioVisualization();
    };
  }, [
    isSupported,
    SpeechRecognitionClass,
    lang,
    continuous,
    interimResults,
    maxAlternatives,
    onResult,
    onError,
    onEnd,
    initAudioVisualization,
    cleanupAudioVisualization,
  ]);

  const startListening = useCallback(() => {
    if (!isSupported || !recognitionRef.current) {
      const errorMsg = 'Speech recognition is not supported in this browser. Please use Chrome or Edge.';
      console.error(errorMsg);
      setError(errorMsg);
      return;
    }

    console.log('Starting speech recognition...');
    try {
      recognitionRef.current.start();
      console.log('Speech recognition started successfully');
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to start speech recognition. Please try again.';
      setError(errorMsg);
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError(null);
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
    audioLevel,
  };
}
