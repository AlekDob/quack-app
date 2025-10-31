import { useState, useRef, useCallback } from 'react';
import OpenAI from 'openai';

interface UseWhisperRecognitionOptions {
  lang?: string;
  apiKey?: string;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

interface UseWhisperRecognitionReturn {
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

export function useWhisperRecognition(
  options: UseWhisperRecognitionOptions = {}
): UseWhisperRecognitionReturn {
  const {
    lang = 'it',
    apiKey,
    onResult,
    onError,
    onEnd,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check if both MediaRecorder and mediaDevices are supported
  const isSupported =
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined' &&
    typeof navigator.mediaDevices.getUserMedia !== 'undefined';

  // Initialize audio visualization
  const initAudioVisualization = useCallback(async (stream: MediaStream) => {
    try {
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

  // Send audio to Whisper API
  const transcribeAudio = useCallback(async (audioBlob: Blob) => {
    if (!apiKey) {
      const errorMsg = 'OpenAI API key is required for voice transcription';
      setError(errorMsg);
      if (onError) onError(errorMsg);
      return;
    }

    console.log('[Whisper] Transcribing audio blob:', audioBlob.size, 'bytes');

    try {
      const openai = new OpenAI({
        apiKey,
        dangerouslyAllowBrowser: true, // Required for browser usage
      });

      // Convert blob to File (required by OpenAI API)
      const audioFile = new File([audioBlob], 'audio.webm', {
        type: audioBlob.type,
      });

      console.log('[Whisper] Sending to API...');
      const response = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: lang,
        response_format: 'text',
      });

      console.log('[Whisper] Got response:', response);

      // Response should be a string when response_format is 'text'
      const transcriptText = String(response);

      setTranscript((prev) => prev + transcriptText + ' ');
      setInterimTranscript('');

      if (onResult) {
        onResult(transcriptText, true);
      }
    } catch (err) {
      console.error('[Whisper] Transcription error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to transcribe audio';
      setError(errorMsg);
      if (onError) onError(errorMsg);
    }
  }, [apiKey, lang, onResult, onError]);

  const startListening = useCallback(async () => {
    if (!isSupported) {
      const errorMsg = 'Audio recording is not supported in this browser';
      console.error('[Whisper]', errorMsg);
      setError(errorMsg);
      if (onError) onError(errorMsg);
      return;
    }

    if (!apiKey) {
      const errorMsg = 'OpenAI API key is required. Please configure it in settings.';
      console.error('[Whisper]', errorMsg);
      setError(errorMsg);
      if (onError) onError(errorMsg);
      return;
    }

    console.log('[Whisper] Starting recording...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Initialize audio visualization
      await initAudioVisualization(stream);

      // Create MediaRecorder
      const options: MediaRecorderOptions = {};

      // Try to use webm format (best compatibility)
      if (MediaRecorder.isTypeSupported('audio/webm')) {
        options.mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options.mimeType = 'audio/mp4';
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('[Whisper] Recording stopped, processing audio...');
        const audioBlob = new Blob(audioChunksRef.current, { type: options.mimeType || 'audio/webm' });

        // Only transcribe if we have audio data
        if (audioBlob.size > 0) {
          await transcribeAudio(audioBlob);
        }

        cleanupAudioVisualization();

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        setIsListening(false);

        if (onEnd) {
          onEnd();
        }
      };

      mediaRecorder.start();
      setIsListening(true);
      setError(null);

      console.log('[Whisper] Recording started successfully');
    } catch (err) {
      console.error('[Whisper] Failed to start recording:', err);
      let errorMessage = 'Failed to start audio recording';

      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          errorMessage = 'Microphone permission denied. Please allow microphone access.';
        } else if (err.name === 'NotFoundError') {
          errorMessage = 'No microphone found. Please check your audio settings.';
        } else {
          errorMessage = `Recording error: ${err.message}`;
        }
      }

      setError(errorMessage);
      setIsListening(false);
      cleanupAudioVisualization();

      if (onError) {
        onError(errorMessage);
      }
    }
  }, [isSupported, apiKey, initAudioVisualization, transcribeAudio, cleanupAudioVisualization, onError, onEnd]);

  const stopListening = useCallback(() => {
    console.log('[Whisper] Stopping recording...');

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
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
