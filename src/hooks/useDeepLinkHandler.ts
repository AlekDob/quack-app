// Hook to handle deep link file opening from Quack Inspector
import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

interface OpenFilePayload {
  path: string;
  line?: number;
  column?: number;
}

export function useDeepLinkHandler(onOpenFile: (payload: OpenFilePayload) => void) {
  // ✅ FIX: Use ref to avoid infinite loop when onOpenFile changes
  const onOpenFileRef = useRef(onOpenFile);

  // Update ref when onOpenFile changes
  useEffect(() => {
    onOpenFileRef.current = onOpenFile;
  }, [onOpenFile]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    // Listen for deep-link-open-file events
    const setupListener = async () => {
      try {
        // Register deep link handler on backend (only once)
        await invoke('register_deep_link_handler');
        console.log('🦆 Deep link handler registered');

        // Listen for events from backend
        unlisten = await listen<OpenFilePayload>('deep-link-open-file', (event) => {
          console.log('🦆 Received deep link event:', event.payload);
          onOpenFileRef.current(event.payload); // Use ref to get latest callback
        });

        console.log('🦆 Listening for deep-link-open-file events');
      } catch (error) {
        console.error('🦆 Failed to setup deep link listener:', error);
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []); // ✅ Empty deps array - setup only once
}

// Helper to test deep link
async function testDeepLink(url: string): Promise<OpenFilePayload | null> {
  try {
    const result = await invoke<OpenFilePayload>('test_deep_link', { url });
    console.log('🦆 Deep link test result:', result);
    return result;
  } catch (error) {
    console.error('🦆 Deep link test failed:', error);
    return null;
  }
}
