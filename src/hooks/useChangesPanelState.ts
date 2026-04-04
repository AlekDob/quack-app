import { useState, useCallback, useRef, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'

type FileStatus = 'created' | 'modified' | 'deleted'

interface DiffState {
  content: string
  loading: boolean
  error: string | null
}

interface UseChangesPanelStateParams {
  rootPath: string | null
  modifiedFiles: Map<string, FileStatus>
  onRefreshGitStatus: () => void
  onRemoveModifiedFiles?: (paths: string[]) => void
  lastRefreshTs?: number
}

const getRelPath = (filePath: string, rootPath: string | null): string => {
  if (rootPath && filePath.startsWith(rootPath)) {
    const rel = filePath.substring(rootPath.length)
    return rel.startsWith('/') ? rel.substring(1) : rel
  }
  return filePath
}

const removeFromSet = (prev: Set<string>, key: string): Set<string> => {
  const next = new Set(prev); next.delete(key); return next
}

const removeFromMap = <V>(prev: Map<string, V>, key: string): Map<string, V> => {
  const next = new Map(prev); next.delete(key); return next
}

export function useChangesPanelState({
  rootPath,
  modifiedFiles,
  onRefreshGitStatus,
  onRemoveModifiedFiles,
  lastRefreshTs,
}: UseChangesPanelStateParams) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
  const [diffCache, setDiffCache] = useState<Map<string, DiffState>>(new Map())
  const [fileToDelete, setFileToDelete] = useState<string | null>(null)
  const [showCommitModal, setShowCommitModal] = useState(false)
  const [commitTitle, setCommitTitle] = useState('')
  const [commitDesc, setCommitDesc] = useState('')
  const [committing, setCommitting] = useState(false)
  const [stagedFiles, setStagedFiles] = useState<Set<string>>(new Set())
  const [committedFiles, setCommittedFiles] = useState<Set<string>>(new Set())

  const expandedFilesRef = useRef(expandedFiles)
  useEffect(() => { expandedFilesRef.current = expandedFiles }, [expandedFiles])

  const committedFilesRef = useRef(committedFiles)
  useEffect(() => { committedFilesRef.current = committedFiles }, [committedFiles])

  const onRefreshGitStatusRef = useRef(onRefreshGitStatus)
  useEffect(() => { onRefreshGitStatusRef.current = onRefreshGitStatus }, [onRefreshGitStatus])

  const allEntries = Array.from(modifiedFiles.entries())
  const pendingEntries = allEntries.filter(([fp]) => !committedFiles.has(fp))
  const committedEntries = allEntries.filter(([fp]) => committedFiles.has(fp))

  // Brain: fix-changes-panel-cpu-loop
  const reconcileWithGit = useCallback(async () => {
    if (!rootPath || modifiedFiles.size === 0) return
    const relativePaths = Array.from(modifiedFiles.keys()).map((fp) => getRelPath(fp, rootPath))
    try {
      const stillDirty = await invoke<string[]>('git_check_files_dirty', { paths: relativePaths, rootPath })
      const dirtySet = new Set(stillDirty)
      const currentCommitted = committedFilesRef.current
      const newCommitted = new Set(currentCommitted)
      let changed = false
      for (const [fp] of modifiedFiles.entries()) {
        const rel = getRelPath(fp, rootPath)
        if (!dirtySet.has(rel) && !currentCommitted.has(fp)) { newCommitted.add(fp); changed = true }
      }
      if (changed) { setCommittedFiles(newCommitted); onRefreshGitStatusRef.current() }
    } catch { /* Silent fail */ }
  }, [rootPath, modifiedFiles])

  useEffect(() => {
    window.addEventListener('focus', reconcileWithGit)
    return () => window.removeEventListener('focus', reconcileWithGit)
  }, [reconcileWithGit])

  useEffect(() => {
    if (lastRefreshTs && lastRefreshTs > 0) void reconcileWithGit()
  }, [lastRefreshTs, reconcileWithGit])

  const loadDiff = useCallback(async (filePath: string, status: FileStatus) => {
    const relativePath = getRelPath(filePath, rootPath)
    setDiffCache((prev) => { const next = new Map(prev); next.set(filePath, { content: '', loading: true, error: null }); return next })
    try {
      let content = ''
      if (status === 'created') {
        const fileContent = await invoke<string>('read_file_content', { path: filePath, rootPath })
        const lines = fileContent.split('\n')
        content = `diff --git a/${relativePath} b/${relativePath}\nnew file\n--- /dev/null\n+++ b/${relativePath}\n@@ -0,0 +1,${lines.length} @@\n`
        content += lines.map((l) => `+${l}`).join('\n')
      } else {
        content = await invoke<string>('git_diff', { path: relativePath, staged: false, untracked: true, rootPath })
      }
      setDiffCache((prev) => {
        if (!expandedFilesRef.current.has(filePath)) return prev
        const next = new Map(prev); next.set(filePath, { content, loading: false, error: null }); return next
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setDiffCache((prev) => { const next = new Map(prev); next.set(filePath, { content: '', loading: false, error: msg }); return next })
    }
  }, [rootPath])

  // Brain: gotcha-console-log-inside-state-updater
  const toggleFile = useCallback((filePath: string) => {
    const status = modifiedFiles.get(filePath) ?? 'modified'
    const shouldLoad = !diffCache.has(filePath) && !expandedFiles.has(filePath)
    setExpandedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(filePath)) { next.delete(filePath) } else { next.add(filePath) }
      return next
    })
    if (shouldLoad) void loadDiff(filePath, status)
  }, [modifiedFiles, diffCache, expandedFiles, loadDiff])

  const handleStageFile = useCallback(async (filePath: string) => {
    const relativePath = getRelPath(filePath, rootPath)
    try {
      await invoke('git_stage', { path: relativePath, rootPath })
      setStagedFiles((prev) => new Set(prev).add(filePath))
      toast.success(`Staged: ${relativePath}`)
      onRefreshGitStatus()
    } catch (err) { console.error('[ChangesPanel] Failed to stage:', err); toast.error(`Failed to stage: ${err}`) }
  }, [rootPath, onRefreshGitStatus])

  const handleDiscardFile = useCallback(async (filePath: string) => {
    const status = modifiedFiles.get(filePath) ?? 'modified'
    // Brain: gotcha-window-confirm-tauri-webview
    if (status === 'created') { setFileToDelete(filePath); return }
    const relativePath = getRelPath(filePath, rootPath)
    try {
      await invoke('git_discard_file', { path: relativePath, isUntracked: false, rootPath })
      setExpandedFiles((prev) => removeFromSet(prev, filePath))
      setDiffCache((prev) => removeFromMap(prev, filePath))
      toast.success(`Discarded: ${relativePath}`)
      onRefreshGitStatus()
    } catch (err) { console.error('[ChangesPanel] Failed to discard:', err); toast.error(`Failed to discard: ${err}`) }
  }, [modifiedFiles, rootPath, onRefreshGitStatus])

  const confirmDeleteFile = useCallback(async () => {
    if (!fileToDelete) return
    const relativePath = getRelPath(fileToDelete, rootPath)
    try {
      await invoke('git_discard_file', { path: relativePath, isUntracked: true, rootPath })
      setExpandedFiles((prev) => removeFromSet(prev, fileToDelete))
      setDiffCache((prev) => removeFromMap(prev, fileToDelete))
      toast.success(`Deleted: ${relativePath}`)
      onRefreshGitStatus()
    } catch (err) { console.error('[ChangesPanel] Failed to delete file:', err); toast.error(`Failed to delete: ${err}`) }
    finally { setFileToDelete(null) }
  }, [fileToDelete, rootPath, onRefreshGitStatus])

  const handleAcceptAll = useCallback(async () => {
    try {
      await invoke('git_stage_all', { rootPath })
      setStagedFiles(new Set(pendingEntries.map(([fp]) => fp)))
      toast.success('All files staged')
      onRefreshGitStatus()
    } catch (err) { console.error('[ChangesPanel] Failed to stage all:', err); toast.error(`Failed to stage all: ${err}`) }
  }, [rootPath, pendingEntries, onRefreshGitStatus])

  const handleCommit = useCallback(async () => {
    if (!commitTitle.trim()) { toast.error('Commit title required'); return }
    setCommitting(true)
    try {
      const message = commitDesc.trim() ? `${commitTitle.trim()}\n\n${commitDesc.trim()}` : commitTitle.trim()
      await invoke('git_stage_all', { rootPath })
      await invoke('git_commit', { message, rootPath })
      toast.success('Commit created!')
      setCommitTitle(''); setCommitDesc(''); setShowCommitModal(false)
      setCommittedFiles((prev) => { const next = new Set(prev); pendingEntries.forEach(([fp]) => next.add(fp)); return next })
      setStagedFiles(new Set()); setExpandedFiles(new Set()); setDiffCache(new Map())
      onRefreshGitStatus()
    } catch (err) { console.error('[ChangesPanel] Failed to commit:', err); toast.error(`Commit failed: ${err}`) }
    finally { setCommitting(false) }
  }, [commitTitle, commitDesc, rootPath, pendingEntries, onRefreshGitStatus])

  const handleClearCommitted = useCallback(() => {
    const pathsToClear = committedEntries.map(([fp]) => fp)
    setCommittedFiles(new Set())
    onRemoveModifiedFiles?.(pathsToClear)
  }, [committedEntries, onRemoveModifiedFiles])

  return {
    // State
    expandedFiles, diffCache, stagedFiles, committedFiles,
    fileToDelete, setFileToDelete,
    showCommitModal, setShowCommitModal,
    commitTitle, setCommitTitle,
    commitDesc, setCommitDesc,
    committing,
    // Derived
    pendingEntries, committedEntries,
    // Handlers
    toggleFile,
    handleStageFile,
    handleDiscardFile,
    confirmDeleteFile,
    handleAcceptAll,
    handleCommit,
    handleClearCommitted,
  }
}
