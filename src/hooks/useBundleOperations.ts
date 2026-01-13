import { useState } from 'react';
import type { SavedAgent } from '../types';
import {
  exportAgentBundleAsZip,
  importAgentBundle,
} from '../services/bundleService';
import { saveAgent } from '../utils/agentStorage';

interface BundleOperationsState {
  exporting: boolean;
  importing: boolean;
  error: string | null;
}

interface BundleOperations {
  exporting: boolean;
  importing: boolean;
  error: string | null;
  exportAgent: (agent: SavedAgent) => Promise<void>;
  importBundle: () => Promise<SavedAgent | null>;
  clearError: () => void;
}

/**
 * Hook for bundle export/import operations
 *
 * Provides functions to:
 * - Export an agent as a .zip bundle
 * - Import an agent from a .zip bundle
 */
export function useBundleOperations(): BundleOperations {
  const [state, setState] = useState<BundleOperationsState>({
    exporting: false,
    importing: false,
    error: null,
  });

  /**
   * Export an agent as a downloadable .zip bundle
   */
  async function exportAgent(agent: SavedAgent): Promise<void> {
    console.log('[useBundleOperations] exportAgent called', { agentName: agent.name, agentId: agent.id });
    setState((prev) => ({ ...prev, exporting: true, error: null }));

    try {
      // Prepare equipment data from personality
      const skills = (agent.personality?.skills || []).map((id) => ({
        id,
        content: '', // In real implementation, we'd read the actual skill content
      }));

      const rules = (agent.personality?.selectedRules || []).map((id) => ({
        id,
        content: '', // In real implementation, we'd read the actual rule content
      }));

      // Export as ZIP
      const zipData = await exportAgentBundleAsZip(
        agent,
        skills,
        [], // droids
        rules,
        [] // commands
      );

      // Create download link
      const blob = new Blob([zipData], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${agent.name.toLowerCase().replace(/\s+/g, '-')}-bundle.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setState((prev) => ({ ...prev, exporting: false }));
    } catch (err) {
      console.error('Failed to export agent bundle:', err);
      setState((prev) => ({
        ...prev,
        exporting: false,
        error: `Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }));
    }
  }

  /**
   * Import an agent from a .zip bundle file
   * Opens file picker and returns the imported agent
   */
  async function importBundle(): Promise<SavedAgent | null> {
    setState((prev) => ({ ...prev, importing: true, error: null }));

    try {
      // Create file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.zip';

      // Wait for file selection
      const file = await new Promise<File | null>((resolve) => {
        input.onchange = (e) => {
          const target = e.target as HTMLInputElement;
          resolve(target.files?.[0] || null);
        };
        input.oncancel = () => resolve(null);
        input.click();
      });

      if (!file) {
        setState((prev) => ({ ...prev, importing: false }));
        return null;
      }

      // Read file as Uint8Array
      const arrayBuffer = await file.arrayBuffer();
      const bundleData = new Uint8Array(arrayBuffer);

      // Import bundle
      const result = await importAgentBundle(bundleData);

      // Save to agent storage
      saveAgent({
        name: result.agent.name,
        avatar: result.agent.avatar,
        color: result.agent.color,
        workingOn: result.agent.workingOn,
        personality: result.agent.personality,
      });

      setState((prev) => ({ ...prev, importing: false }));
      return result.agent;
    } catch (err) {
      console.error('Failed to import agent bundle:', err);
      setState((prev) => ({
        ...prev,
        importing: false,
        error: `Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }));
      return null;
    }
  }

  function clearError() {
    setState((prev) => ({ ...prev, error: null }));
  }

  return {
    exporting: state.exporting,
    importing: state.importing,
    error: state.error,
    exportAgent,
    importBundle,
    clearError,
  };
}
