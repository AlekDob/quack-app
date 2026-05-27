import { Store } from '@tauri-apps/plugin-store';
import type { JackSession } from '../stores/jackStore';

const STORE_FILE = 'jack-sessions.json';
const SESSIONS_KEY = 'sessions';
const MAX_TIMELINE_PER_SESSION = 500;

let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = Store.load(STORE_FILE);
  }
  return storePromise;
}

export async function loadJackSessions(): Promise<JackSession[]> {
  try {
    const store = await getStore();
    const raw = await store.get<JackSession[]>(SESSIONS_KEY);
    return Array.isArray(raw) ? raw : [];
  } catch (err) {
    console.warn('[Jack] Failed to load sessions:', err);
    return [];
  }
}

export async function saveJackSessions(sessions: JackSession[]): Promise<void> {
  try {
    const store = await getStore();
    const trimmed = sessions.map((s) => ({
      ...s,
      timeline:
        s.timeline.length > MAX_TIMELINE_PER_SESSION
          ? s.timeline.slice(-MAX_TIMELINE_PER_SESSION)
          : s.timeline,
    }));
    await store.set(SESSIONS_KEY, trimmed);
    await store.save();
  } catch (err) {
    console.warn('[Jack] Failed to save sessions:', err);
  }
}
