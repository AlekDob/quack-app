import { useState } from 'react';
import type { SavedAgent } from '../types';
import {
  exportAgentBundleAsZip,
  importAgentBundle,
} from '../services/bundleService';
import { saveAgent } from '../utils/agentStorage';
import { save as saveDialog, open as openDialog } from '@tauri-apps/plugin-dialog';
import { writeFile, readFile } from '@tauri-apps/plugin-fs';

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

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/3ea3e874-66c9-4ccd-807c-e75a9897e915',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useBundleOperations.ts:57',message:'H1: Before ZIP generation',data:{skillsCount:skills.length,rulesCount:rules.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion

      // Export as ZIP
      const zipData = await exportAgentBundleAsZip(
        agent,
        skills,
        [], // droids
        rules,
        [] // commands
      );

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/3ea3e874-66c9-4ccd-807c-e75a9897e915',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useBundleOperations.ts:68',message:'H1: After ZIP generation SUCCESS',data:{zipSize:zipData?.byteLength,zipType:typeof zipData},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion

      // Create download link
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/3ea3e874-66c9-4ccd-807c-e75a9897e915',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useBundleOperations.ts:72',message:'H2: Before Blob creation',data:{zipSize:zipData.byteLength},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion

      const blob = new Blob([zipData], { type: 'application/zip' });

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/3ea3e874-66c9-4ccd-807c-e75a9897e915',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useBundleOperations.ts:78',message:'H2: Blob created',data:{blobSize:blob.size,blobType:blob.type},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion

      const filename = `${agent.name.toLowerCase().replace(/\s+/g, '-')}-bundle.zip`;

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/3ea3e874-66c9-4ccd-807c-e75a9897e915',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useBundleOperations.ts:82',message:'H9: Using Tauri native save dialog',data:{filename,isTauri:!!window.__TAURI__},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H9'})}).catch(()=>{});
      // #endregion

      // Use Tauri's native save dialog
      const savePath = await saveDialog({
        defaultPath: filename,
        filters: [{
          name: 'Quack Agent Bundle',
          extensions: ['zip']
        }]
      });

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/3ea3e874-66c9-4ccd-807c-e75a9897e915',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useBundleOperations.ts:95',message:'H9: Save dialog result',data:{savePath,cancelled:!savePath},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H9'})}).catch(()=>{});
      // #endregion

      if (!savePath) {
        // User cancelled the dialog
        setState((prev) => ({ ...prev, exporting: false }));
        return;
      }

      // Write the file using Tauri's fs plugin
      await writeFile(savePath, zipData);

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/3ea3e874-66c9-4ccd-807c-e75a9897e915',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useBundleOperations.ts:112',message:'H9: File written successfully!',data:{savePath,size:zipData.byteLength},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H9'})}).catch(()=>{});
      // #endregion

      setState((prev) => ({ ...prev, exporting: false }));
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/3ea3e874-66c9-4ccd-807c-e75a9897e915',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useBundleOperations.ts:118',message:'H4: CATCH BLOCK - Error occurred!',data:{error:err instanceof Error ? err.message : String(err),stack:err instanceof Error ? err.stack : undefined},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion

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
      // Use Tauri's native file picker
      const selectedPath = await openDialog({
        multiple: false,
        filters: [{
          name: 'Quack Agent Bundle',
          extensions: ['zip']
        }]
      });

      if (!selectedPath) {
        setState((prev) => ({ ...prev, importing: false }));
        return null;
      }

      // Read file using Tauri's fs plugin
      const bundleData = await readFile(selectedPath as string);

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
