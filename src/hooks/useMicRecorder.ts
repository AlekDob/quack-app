import { useCallback, useEffect, useRef, useState } from 'react';
import { startRecording, stopRecording } from 'tauri-plugin-mic-recorder-api';

interface UseMicRecorderOptions {
  lang?: string;
  apiKey?: string;
  onResult?: (text: string, isFinal: boolean) => void;
  onError?: (error: Error) => void;
  onEnd?: () => void;
}

interface UseMicRecorderReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: Error | null;
  isSupported: boolean;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  cancelListening: () => Promise<void>;
  resetTranscript: () => void;
  audioLevel: number;
}

/**
 * Hook for recording audio using tauri-plugin-mic-recorder and transcribing with Whisper API
 */
export function useMicRecorder(
  options: UseMicRecorderOptions = {}
): UseMicRecorderReturn {
  const { lang = 'it', apiKey, onResult, onError, onEnd } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const audioLevelIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if Tauri and the plugin are available
  const isSupported = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

  // Simulate audio level animation while recording
  const simulateAudioLevel = useCallback(() => {
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
    }

    audioLevelIntervalRef.current = setInterval(() => {
      // Generate random audio level between 0.2 and 0.9 for animation
      const randomLevel = 0.2 + Math.random() * 0.7;
      setAudioLevel(randomLevel);
    }, 100);
  }, []);

  const stopAudioLevelSimulation = useCallback(() => {
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  // Transcribe audio using Whisper API
  const transcribeAudio = useCallback(
    async (audioFilePath: string) => {
      console.log('[transcribeAudio] Starting transcription for:', audioFilePath);
      console.log('[transcribeAudio] API Key present:', !!apiKey);

      if (!apiKey) {
        const err = new Error('OpenAI API key not configured');
        console.error('[transcribeAudio]', err);
        setError(err);
        if (onError) onError(err);
        return;
      }

      try {
        // Read the WAV file from disk
        console.log('[transcribeAudio] Importing fs plugin...');
        const { readFile } = await import('@tauri-apps/plugin-fs');

        console.log('[transcribeAudio] Reading audio file...');
        const audioData = await readFile(audioFilePath);
        console.log('[transcribeAudio] ===== AUDIO FILE INFO =====');
        console.log('[transcribeAudio] File path:', audioFilePath);
        console.log('[transcribeAudio] Audio data size:', audioData.length, 'bytes');
        console.log('[transcribeAudio] Audio data type:', audioData.constructor.name);

        // Check WAV header (first 44 bytes should be the WAV header)
        if (audioData.length < 44) {
          console.error('[transcribeAudio] ⚠️ ERROR: Audio file too small! (< 44 bytes)');
          console.error('[transcribeAudio] This is likely an empty or corrupted WAV file');
        } else {
          // Log first few bytes to verify WAV format (should start with "RIFF")
          const headerBytes = audioData.slice(0, 4);
          const headerString = new TextDecoder().decode(headerBytes);
          console.log('[transcribeAudio] WAV header signature:', headerString, '(should be "RIFF")');

          if (headerString !== 'RIFF') {
            console.error('[transcribeAudio] ⚠️ ERROR: Invalid WAV file! Header does not start with "RIFF"');
          }
        }
        console.log('[transcribeAudio] ==========================');

        // Create a Blob from the audio data
        const audioBlob = new Blob([audioData], { type: 'audio/wav' });
        console.log('[transcribeAudio] Created audio blob, size:', audioBlob.size);

        // Create FormData for Whisper API
        const formData = new FormData();
        formData.append('file', audioBlob, 'recording.wav');
        formData.append('model', 'whisper-1');
        formData.append('language', lang);
        formData.append('response_format', 'text');
        console.log('[transcribeAudio] FormData created, calling Whisper API...');

        // Call Whisper API
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: formData,
        });

        console.log('[transcribeAudio] ===== WHISPER API RESPONSE =====');
        console.log('[transcribeAudio] Status:', response.status);
        console.log('[transcribeAudio] Status text:', response.statusText);
        console.log('[transcribeAudio] Headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[transcribeAudio] Whisper API error response:', errorText);
          throw new Error(`Whisper API error: ${response.status} ${response.statusText}`);
        }

        const transcriptionText = await response.text();
        console.log('[transcribeAudio] Raw transcription text:', transcriptionText);
        console.log('[transcribeAudio] Text length:', transcriptionText.length);
        console.log('[transcribeAudio] Text type:', typeof transcriptionText);

        // Check if we got a placeholder/empty response
        if (transcriptionText.includes('Amara.org') || transcriptionText.trim().length === 0) {
          console.warn('[transcribeAudio] ⚠️ WARNING: Got placeholder or empty transcription!');
          console.warn('[transcribeAudio] This usually means the audio file is empty, corrupted, or too short.');
          console.warn('[transcribeAudio] Audio file path:', audioFilePath);
          console.warn('[transcribeAudio] Audio data size:', audioData.length, 'bytes');
        }
        console.log('[transcribeAudio] =================================');

        setTranscript(transcriptionText);
        setInterimTranscript('');

        if (onResult) {
          console.log('[transcribeAudio] Calling onResult callback');
          onResult(transcriptionText, true);
        }

        if (onEnd) {
          console.log('[transcribeAudio] Calling onEnd callback');
          onEnd();
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('[transcribeAudio] Error:', error);
        setError(error);
        if (onError) onError(error);
      }
    },
    [apiKey, lang, onResult, onError, onEnd]
  );

  // Start recording
  const startListening = useCallback(async () => {
    console.log('[useMicRecorder] startListening called');
    console.log('[useMicRecorder] isSupported:', isSupported);

    if (!isSupported) {
      const err = new Error('Tauri mic recorder plugin not available');
      console.error('[useMicRecorder]', err);
      setError(err);
      if (onError) onError(err);
      return;
    }

    try {
      setError(null);
      setTranscript('');
      setInterimTranscript('');

      console.log('[useMicRecorder] Calling startRecording()...');
      // Start recording using the plugin
      // Note: startRecording() may return void or null - the file path is returned by stopRecording()
      await startRecording();
      console.log('[useMicRecorder] Recording started (file path will be provided on stop)');

      setIsListening(true);
      simulateAudioLevel();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[useMicRecorder] Error starting recording:', error);
      setError(error);
      setIsListening(false);
      if (onError) onError(error);
    }
  }, [isSupported, simulateAudioLevel, onError]);

  // Stop recording and transcribe
  const stopListening = useCallback(async () => {
    if (!isListening) return;

    console.log('[useMicRecorder] Stop button clicked');

    try {
      stopAudioLevelSimulation();

      console.log('[useMicRecorder] Calling stopRecording()...');
      // Stop recording using the plugin
      const filePath = await stopRecording();
      console.log('[useMicRecorder] Recording stopped. File path:', filePath);

      setIsListening(false);

      // Transcribe the recorded audio
      if (filePath) {
        console.log('[useMicRecorder] Starting transcription...');
        await transcribeAudio(filePath);
        console.log('[useMicRecorder] Transcription completed');
      } else {
        console.error('[useMicRecorder] No file path returned from stopRecording()');
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[useMicRecorder] Error in stopListening:', error);
      setError(error);
      setIsListening(false);
      if (onError) onError(error);
    }
  }, [isListening, stopAudioLevelSimulation, transcribeAudio, onError]);

  // Cancel recording without transcription
  const cancelListening = useCallback(async () => {
    if (!isListening) return;

    console.log('[useMicRecorder] Cancel button clicked - stopping without transcription');

    try {
      stopAudioLevelSimulation();

      console.log('[useMicRecorder] Calling stopRecording() (cancel mode)...');
      // Stop recording but don't transcribe
      await stopRecording();
      console.log('[useMicRecorder] Recording cancelled without transcription');

      setIsListening(false);
      setTranscript('');
      setInterimTranscript('');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[useMicRecorder] Error in cancelListening:', error);
      setError(error);
      setIsListening(false);
      if (onError) onError(error);
    }
  }, [isListening, stopAudioLevelSimulation, onError]);

  // Reset transcript
  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    cancelListening,
    resetTranscript,
    audioLevel,
  };
}
