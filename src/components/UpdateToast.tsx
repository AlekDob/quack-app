/**
 * UpdateToast Component
 *
 * Listens for available updates and shows a non-intrusive
 * toast notification once per new version detected.
 * Uses sonner for toast rendering with custom glassmorphism style.
 */

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { open } from '@tauri-apps/plugin-shell';
import { useUpdateChecker } from '../hooks/useUpdateChecker';
import { getBaseVersion } from '../utils/version';
import './UpdateToast.css';

const DISMISSED_VERSION_KEY = 'quack_update_toast_dismissed_version';

function wasDismissed(version: string): boolean {
  try {
    return localStorage.getItem(DISMISSED_VERSION_KEY) === version;
  } catch {
    return false;
  }
}

function markDismissed(version: string): void {
  try {
    localStorage.setItem(DISMISSED_VERSION_KEY, version);
  } catch { /* noop */ }
}

interface UpdateToastContentProps {
  currentVersion: string;
  newVersion: string;
  downloadUrl: string;
  toastId: string | number;
}

function UpdateToastContent({
  currentVersion,
  newVersion,
  downloadUrl,
  toastId,
}: UpdateToastContentProps) {
  return (
    <div className="update-toast">
      {/* Icon */}
      <div className="update-toast__icon">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </div>

      {/* Content */}
      <div className="update-toast__content">
        <div className="update-toast__title">Update Available</div>
        <div className="update-toast__version">
          v{currentVersion} &rarr; {newVersion}
        </div>
      </div>

      {/* Actions */}
      <div className="update-toast__actions">
        <button
          className="update-toast__btn update-toast__btn--download"
          onClick={() => {
            open(downloadUrl);
            markDismissed(newVersion);
            toast.dismiss(toastId);
          }}
        >
          Download
        </button>
        <button
          className="update-toast__btn update-toast__btn--dismiss"
          onClick={() => {
            markDismissed(newVersion);
            toast.dismiss(toastId);
          }}
        >
          Later
        </button>
      </div>

      {/* Accent line */}
      <div className="update-toast__accent" />
    </div>
  );
}

/**
 * Mount this component once in App.tsx.
 * It will check for updates and show a toast if a new version is available.
 */
export default function UpdateToast() {
  const { updateAvailable, latestRelease, currentVersion } = useUpdateChecker();
  const shownRef = useRef(false);

  useEffect(() => {
    if (!updateAvailable || !latestRelease || shownRef.current) return;

    const newVersion = getBaseVersion(latestRelease.tag_name);
    if (wasDismissed(newVersion)) return;

    shownRef.current = true;

    // Delay toast slightly so the app finishes loading first
    const timer = setTimeout(() => {
      toast.custom(
        (t) => (
          <UpdateToastContent
            currentVersion={currentVersion}
            newVersion={newVersion}
            downloadUrl={latestRelease.html_url}
            toastId={t}
          />
        ),
        {
          duration: 15000,
          position: 'bottom-right',
        }
      );
    }, 3000);

    return () => clearTimeout(timer);
  }, [updateAvailable, latestRelease, currentVersion]);

  // Renderless component — toast is triggered via sonner
  return null;
}
