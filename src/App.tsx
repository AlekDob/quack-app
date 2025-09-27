import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { dirname } from '@tauri-apps/api/path'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification'

import TerminalSidebar from './components/TerminalSidebar'
import TerminalView from './components/TerminalView'
import FileExplorer from './components/FileExplorer'
import NewTerminalModal from './components/NewTerminalModal'
import FilePreviewModal from './components/FilePreviewModal'

import type {
  DirectoryEntry,
  DirectoryListing,
  TerminalExitEvent,
  TerminalInfo,
} from './types'

import './App.css'

const splashImage = new URL('../images/quackapp.jpeg', import.meta.url).href

const COLORS = ['#ec7241', '#4ecdc4', '#ffd166', '#a78bfa', '#60a5fa', '#f97316', '#f472b6']

// eslint-disable-next-line no-control-regex
const ANSI_REGEX = new RegExp('\\x1B\\[[0-9;?]*[ -/]*[@-~]', 'g')
// eslint-disable-next-line no-control-regex
const OSC_REGEX = new RegExp('\\x1B\\][^\\x07]*\\x07', 'g')
const PROMPT_REGEX = /(?:[$#%>|❯])\s*$/

const normalizeKey = (value: string): string => value.trim().toLowerCase()
const slugify = (value: string): string => normalizeKey(value).replace(/[^a-z0-9]+/g, '-')

const stripAnsi = (text: string): string => text.replace(OSC_REGEX, '').replace(ANSI_REGEX, '')

const chunkContainsPrompt = (text: string): boolean => {
  const sanitized = stripAnsi(text).replace(/\r/g, '\n')
  const lines = sanitized.split('\n').map((line) => line.trimEnd()).filter(Boolean)
  if (lines.length === 0) {
    return false
  }
  return PROMPT_REGEX.test(lines[lines.length - 1])
}

const playQuackSound = () => {
  if (typeof window === 'undefined') {
    return
  }
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) {
      return
    }
    const ctx = new AudioCtx()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.type = 'square'
    const now = ctx.currentTime
    oscillator.frequency.setValueAtTime(520, now)
    oscillator.frequency.exponentialRampToValueAtTime(250, now + 0.25)

    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.45, now + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45)

    oscillator.connect(gain)
    gain.connect(ctx.destination)

    oscillator.start(now)
    oscillator.stop(now + 0.5)
    oscillator.onended = () => {
      const close = (ctx as AudioContext & { close?: () => Promise<void> }).close
      if (typeof close === 'function') {
        try {
          const result = close.call(ctx)
          const promiseLike = result as Promise<void>
          if (promiseLike && typeof promiseLike.then === 'function') {
            promiseLike.catch(() => undefined)
          }
        } catch {
          // ignore close errors
        }
      }
    }
  } catch (error) {
    console.warn('Impossibile riprodurre l’audio di notifica', error)
  }
}

function App() {
  const [tauriAvailable] = useState(
    () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window,
  )
  const [terminals, setTerminals] = useState<TerminalInfo[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [explorerPath, setExplorerPath] = useState('')
  const [entries, setEntries] = useState<DirectoryEntry[]>([])
  const [loadingExplorer, setLoadingExplorer] = useState(false)
  const [explorerError, setExplorerError] = useState<string | null>(null)
  const [creatingTerminal, setCreatingTerminal] = useState(false)
  const [showNewTerminalModal, setShowNewTerminalModal] = useState(false)
  const [newTerminalName, setNewTerminalName] = useState('')
  const [newTerminalPath, setNewTerminalPath] = useState('')
  const [newTerminalColor, setNewTerminalColor] = useState(COLORS[0])
  const [newTerminalError, setNewTerminalError] = useState<string | null>(null)
  const [selectingDirectory, setSelectingDirectory] = useState(false)
  const [notificationGranted, setNotificationGranted] = useState(false)
  const [booting, setBooting] = useState(true)
  const [previewFile, setPreviewFile] = useState<{ name: string; path: string } | null>(null)
  const [previewContent, setPreviewContent] = useState('')
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const idleTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const terminalsRef = useRef<TerminalInfo[]>([])
  const IDLE_TIMEOUT_MS = 2000

  const activeTerminal = useMemo(
    () => terminals.find((terminal) => terminal.id === activeId) ?? null,
    [activeId, terminals],
  )

  useEffect(() => {
    terminalsRef.current = terminals
  }, [terminals])

  const ensureNotificationPermission = useCallback(async (): Promise<boolean> => {
    if (!tauriAvailable) {
      return false
    }
    try {
      let granted = await isPermissionGranted()
      if (!granted) {
        const permission = await requestPermission()
        granted = permission === 'granted'
      }
      setNotificationGranted(granted)
      return granted
    } catch (error) {
      console.warn('Impossibile verificare i permessi di notifica', error)
      setNotificationGranted(false)
      return false
    }
  }, [tauriAvailable])

  const notifyTerminalReady = useCallback(
    async (payload: { id: string; label: string }) => {
      playQuackSound()

      if (!tauriAvailable) {
        return
      }

      let granted = notificationGranted
      if (!granted) {
        granted = await ensureNotificationPermission()
      }

      if (!granted) {
        return
      }

      try {
        await sendNotification({
          id: Number(Date.now() % 2147483647),
          title: 'Terminale pronto',
          body: `${payload.label} è in attesa di input.`,
        })
      } catch (error) {
        console.warn('Impossibile mostrare la notifica', error)
      }
    },
    [ensureNotificationPermission, notificationGranted, tauriAvailable],
  )

  const loadDirectory = useCallback(async (path?: string) => {
    setLoadingExplorer(true)
    setExplorerError(null)
    if (!tauriAvailable) {
      setEntries([])
      setLoadingExplorer(false)
      setExplorerError('Avvia l’app desktop Tauri per usare il file explorer.')
      return
    }
    try {
      const listing = await invoke<DirectoryListing>('list_directory', {
        path: path ?? null,
      })
      setExplorerPath(listing.path)
      setEntries(listing.entries)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setExplorerError(message)
    } finally {
      setLoadingExplorer(false)
    }
  }, [tauriAvailable])

  const markTerminalBusy = useCallback((id: string) => {
    setTerminals((prev) =>
      prev.map((terminal) =>
        terminal.id === id
          ? { ...terminal, status: 'busy', needsAttention: false }
          : terminal,
      ),
    )
  }, [])

  const markTerminalIdle = useCallback(
    (id: string, options?: { suppressNotification?: boolean }) => {
      const suppressNotification = options?.suppressNotification === true
      let notifyInfo: { id: string; label: string } | null = null
      setTerminals((prev) =>
        prev.map((terminal) => {
          if (terminal.id !== id) {
            return terminal
          }
          const wasBusy = terminal.status === 'busy'
          const needsAttention = wasBusy && id !== activeId
          if (needsAttention) {
            notifyInfo = { id: terminal.id, label: terminal.label }
          }
          return {
            ...terminal,
            status: 'idle',
            needsAttention,
          }
        }),
      )

      if (notifyInfo && !suppressNotification) {
        void notifyTerminalReady(notifyInfo)
      }
    },
    [activeId, notifyTerminalReady],
  )

  const clearTerminalAttention = useCallback((id: string) => {
    setTerminals((prev) =>
      prev.map((terminal) =>
        terminal.id === id ? { ...terminal, needsAttention: false } : terminal,
      ),
    )
  }, [])

  const clearIdleTimer = useCallback((id: string) => {
    const timer = idleTimersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      idleTimersRef.current.delete(id)
    }
  }, [])

  const scheduleIdleTimer = useCallback(
    (id: string) => {
      clearIdleTimer(id)
      const handle = setTimeout(() => {
        markTerminalIdle(id)
        idleTimersRef.current.delete(id)
      }, IDLE_TIMEOUT_MS)
      idleTimersRef.current.set(id, handle)
    },
    [clearIdleTimer, markTerminalIdle],
  )

  const resolveTerminalId = useCallback(
    ({ id, label }: { id?: string | null; label?: string | null }) => {
      const terminalsSnapshot = terminalsRef.current
      const candidates = [id, label]

      for (const candidate of candidates) {
        if (!candidate) {
          continue
        }
        const trimmed = candidate.trim()
        if (!trimmed) {
          continue
        }
        const direct = terminalsSnapshot.find((terminal) => terminal.id === trimmed)
        if (direct) {
          return direct.id
        }
      }

      for (const candidate of candidates) {
        if (!candidate) {
          continue
        }
        const trimmed = candidate.trim()
        if (!trimmed) {
          continue
        }
        const normalizedCandidate = normalizeKey(trimmed)
        const labelMatch = terminalsSnapshot.find(
          (terminal) => normalizeKey(terminal.label) === normalizedCandidate,
        )
        if (labelMatch) {
          return labelMatch.id
        }
      }

      for (const candidate of candidates) {
        if (!candidate) {
          continue
        }
        const trimmed = candidate.trim()
        if (!trimmed) {
          continue
        }
        const slugCandidate = slugify(trimmed)
        const slugMatch = terminalsSnapshot.find(
          (terminal) => slugify(terminal.label) === slugCandidate,
        )
        if (slugMatch) {
          return slugMatch.id
        }
      }

      return null
    },
    [],
  )

  const handleTerminalInput = useCallback(
    (id: string, data: string) => {
      if (!data) {
        return
      }
      if (data.includes('\r') || data.includes('\n') || data.trim().length > 0) {
        markTerminalBusy(id)
        clearIdleTimer(id)
      }
    },
    [clearIdleTimer, markTerminalBusy],
  )

  const handleTerminalOutput = useCallback(
    (id: string, data: string) => {
      if (!data) {
        return
      }
      if (chunkContainsPrompt(data)) {
        markTerminalIdle(id)
        clearIdleTimer(id)
      } else {
        markTerminalBusy(id)
        scheduleIdleTimer(id)
      }
    },
    [clearIdleTimer, markTerminalBusy, markTerminalIdle, scheduleIdleTimer],
  )

  useEffect(() => {
    if (!tauriAvailable) {
      return
    }

    const unlistenPromise = listen<{
      id?: string | null
      label?: string | null
      status: string
      notify?: boolean
    }>('external-terminal-status', (event) => {
      const payload = event.payload
      if (!payload) {
        return
      }

      const resolvedId = resolveTerminalId({ id: payload.id ?? undefined, label: payload.label ?? undefined })
      if (!resolvedId) {
        console.warn('Evento hook ignorato: nessun terminale corrisponde a', payload)
        return
      }

      const status = typeof payload.status === 'string' ? payload.status.toLowerCase() : ''
      if (status === 'busy') {
        markTerminalBusy(resolvedId)
        clearIdleTimer(resolvedId)
      } else if (status === 'idle') {
        clearIdleTimer(resolvedId)
        markTerminalIdle(resolvedId, { suppressNotification: payload.notify === false })
      }
    })

    return () => {
      unlistenPromise.then((unlisten) => unlisten()).catch(() => undefined)
    }
  }, [clearIdleTimer, markTerminalBusy, markTerminalIdle, resolveTerminalId, tauriAvailable])


  useEffect(() => {
    if (!tauriAvailable) {
      setBooting(false)
      setExplorerError('Esegui l’app tramite Tauri per attivare i terminali.')
      return
    }

    void ensureNotificationPermission()

    const bootstrap = async () => {
      try {
        await loadDirectory()
        const existing = await invoke<TerminalInfo[]>('list_terminals')
        if (existing.length > 0) {
          const withState = existing.map((terminal) => ({
            ...terminal,
            status: terminal.status ?? 'idle',
            needsAttention: false,
          }))
          setTerminals(withState)
          setActiveId(withState[0].id)
        } else {
          const initial = await invoke<TerminalInfo>('create_terminal', {
            label: 'Terminal 1',
            color: COLORS[0],
            cwd: null,
          })
          const initialWithState = {
            ...initial,
            status: 'idle' as const,
            needsAttention: false,
          }
          setTerminals([initialWithState])
          setActiveId(initialWithState.id)
          await loadDirectory(initialWithState.cwd)
        }
      } catch (error) {
        console.error('Errore durante l’inizializzazione', error)
      } finally {
        setBooting(false)
      }
    }

    void bootstrap()
  }, [ensureNotificationPermission, loadDirectory, tauriAvailable])
  useEffect(() => {
    if (!tauriAvailable) {
      setBooting(false)
    }
  }, [tauriAvailable])


  useEffect(() => {
    let unlisten: (() => void) | undefined

    const connect = async () => {
      try {
        if (!tauriAvailable) {
          return
        }
        unlisten = await listen<TerminalExitEvent>('terminal-exit', (event) => {
          setTerminals((prev) =>
            prev.map((terminal) =>
              terminal.id === event.payload.id
                ? { ...terminal, alive: false }
                : terminal,
            ),
          )
          markTerminalIdle(event.payload.id)
        })
      } catch (error) {
        console.warn('Impossibile ascoltare gli eventi di uscita', error)
      }
    }

    void connect()

    return () => {
      if (unlisten) {
        unlisten()
      }
    }
  }, [markTerminalIdle, tauriAvailable])

  const handleOpenNewTerminalModal = useCallback(() => {
    if (!tauriAvailable) {
      setExplorerError('Terminali disponibili solo tramite l’app desktop.')
      return
    }
    setNewTerminalError(null)
    const index = terminals.length
    const defaultColor = COLORS[index % COLORS.length]
    setNewTerminalName(`Terminal ${index + 1}`)
    setNewTerminalColor(defaultColor)
    const fallbackPath = activeTerminal?.cwd ?? explorerPath ?? ''
    setNewTerminalPath(fallbackPath)
    setShowNewTerminalModal(true)
  }, [activeTerminal, explorerPath, tauriAvailable, terminals.length])

  const handleCancelNewTerminal = useCallback(() => {
    if (creatingTerminal) {
      return
    }
    setShowNewTerminalModal(false)
    setNewTerminalError(null)
    setSelectingDirectory(false)
  }, [creatingTerminal])

  const handleSelectDirectory = useCallback(async () => {
    if (selectingDirectory || !tauriAvailable) {
      return
    }

    setNewTerminalError(null)
    setSelectingDirectory(true)
    try {
      const selected = (await openDialog({
        directory: true,
        multiple: false,
        defaultPath: newTerminalPath || explorerPath || undefined,
        title: 'Seleziona la cartella di lavoro',
      })) as string | string[] | null

      if (typeof selected === 'string') {
        setNewTerminalPath(selected)
      } else if (Array.isArray(selected) && selected.length > 0 && typeof selected[0] === 'string') {
        setNewTerminalPath(selected[0])
      }
    } catch (error) {
      console.error('Impossibile selezionare la cartella', error)
      setNewTerminalError('Impossibile selezionare la cartella. Riprova.')
    } finally {
      setSelectingDirectory(false)
    }
  }, [explorerPath, newTerminalPath, selectingDirectory, tauriAvailable])

  const handleConfirmNewTerminal = useCallback(async () => {
    if (!tauriAvailable || creatingTerminal) {
      return
    }

    const trimmedName = newTerminalName.trim()
    const trimmedPath = newTerminalPath.trim()

    if (!trimmedName) {
      setNewTerminalError('Inserisci un nome per il terminale.')
      return
    }

    if (!trimmedPath) {
      setNewTerminalError('Seleziona la cartella di lavoro.')
      return
    }

    setCreatingTerminal(true)
    setNewTerminalError(null)
    try {
      const created = await invoke<TerminalInfo>('create_terminal', {
        label: trimmedName,
        color: newTerminalColor,
        cwd: trimmedPath,
      })
      const createdWithState: TerminalInfo = {
        ...created,
        status: 'idle',
        needsAttention: false,
      }
      setTerminals((prev) => [...prev, createdWithState])
      setActiveId(createdWithState.id)
      clearTerminalAttention(createdWithState.id)
      setShowNewTerminalModal(false)
      await loadDirectory(createdWithState.cwd)
    } catch (error) {
      console.error('Impossibile creare il terminale', error)
      const message = error instanceof Error ? error.message : String(error)
      setNewTerminalError(message)
    } finally {
      setCreatingTerminal(false)
    }
  }, [clearTerminalAttention, creatingTerminal, loadDirectory, newTerminalColor, newTerminalName, newTerminalPath, tauriAvailable])

  const handleSelectTerminal = useCallback(
    (id: string) => {
      if (!tauriAvailable) {
        return
      }
      setActiveId(id)
      clearTerminalAttention(id)
      clearIdleTimer(id)
      const terminal = terminals.find((candidate) => candidate.id === id)
      if (terminal) {
        void loadDirectory(terminal.cwd)
      }
    },
    [clearIdleTimer, clearTerminalAttention, loadDirectory, tauriAvailable, terminals],
  )

  const handleCloseTerminal = useCallback(
    async (id: string) => {
      if (!tauriAvailable) {
        return
      }
      clearIdleTimer(id)
      try {
        await invoke('close_terminal', { id })
      } catch (error) {
        console.error('Impossibile chiudere il terminale', error)
      }

      let nextActive: string | null = activeId
      let nextPath: string | null = null

      setTerminals((prev) => {
        const updated = prev.filter((terminal) => terminal.id !== id)
        if (updated.length === prev.length) {
          return prev
        }

        if (activeId === id) {
          const fallback = updated[updated.length - 1]
          nextActive = fallback ? fallback.id : null
          nextPath = fallback ? fallback.cwd : null
        }

        return updated
      })

      setActiveId(nextActive)
      if (nextActive) {
        clearTerminalAttention(nextActive)
        clearIdleTimer(nextActive)
      }
      if (nextPath) {
        void loadDirectory(nextPath)
      }
    },
    [activeId, clearIdleTimer, clearTerminalAttention, loadDirectory, tauriAvailable],
  )

  const handleColorChange = useCallback(
    async (id: string, color: string) => {
      if (!tauriAvailable) {
        return
      }
      try {
        const updated = await invoke<TerminalInfo>('set_terminal_color', {
          id,
          color,
        })
        setTerminals((prev) =>
          prev.map((terminal) =>
            terminal.id === id ? { ...terminal, ...updated } : terminal,
          ),
        )
      } catch (error) {
        console.error('Impossibile aggiornare il colore', error)
      }
    },
    [tauriAvailable],
  )

  const handleNavigateUp = useCallback(async () => {
    if (!explorerPath) {
      return
    }
    if (!tauriAvailable) {
      return
    }
    try {
      const parent = await dirname(explorerPath)
      if (parent && parent !== explorerPath) {
        await loadDirectory(parent)
      }
    } catch (error) {
      console.error('Impossibile risalire di cartella', error)
    }
  }, [explorerPath, loadDirectory, tauriAvailable])

  const handleRefreshExplorer = useCallback(() => {
    if (!tauriAvailable) {
      return
    }
    void loadDirectory(explorerPath)
  }, [explorerPath, loadDirectory, tauriAvailable])

  const handleNavigateDirectory = useCallback(
    (path: string) => {
      if (!tauriAvailable) {
        return
      }
      void loadDirectory(path)
    },
    [loadDirectory, tauriAvailable],
  )

  const handleOpenFilePreview = useCallback(
    async (entry: DirectoryEntry) => {
      if (!tauriAvailable || entry.is_dir) {
        return
      }
      setPreviewFile({ name: entry.name, path: entry.path })
      setPreviewContent('')
      setPreviewError(null)
      setLoadingPreview(true)
      try {
        const content = await invoke<string>('read_file_content', { path: entry.path })
        setPreviewContent(content)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setPreviewError(message)
      } finally {
        setLoadingPreview(false)
      }
    },
    [tauriAvailable],
  )

  const handleClosePreview = useCallback(() => {
    setPreviewFile(null)
    setPreviewContent('')
    setPreviewError(null)
    setLoadingPreview(false)
  }, [])

  useEffect(() => {
    const timers = idleTimersRef.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
    }
  }, [])

  if (!tauriAvailable) {
    return (
      <div className="app-fallback">
        <div className="fallback-card">
          <h1>Quack</h1>
          <p>
            Questa interfaccia richiede l’ambiente desktop di Tauri per gestire i
            terminali e il file explorer.
          </p>
          <p>
            Avvia l’app con:
            <code>npm run tauri:dev</code>
          </p>
          <p>Chiudi la scheda del browser e usa la finestra desktop lanciata dal comando.</p>
        </div>
      </div>
    )
  }

  if (booting) {
    return (
      <div className="app-loader">
        <div className="app-loader-card">
          <img src={splashImage} alt="Logo Quack" className="app-loader-image" />
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <TerminalSidebar
        terminals={terminals}
        activeId={activeId}
        creating={creatingTerminal}
        onAdd={handleOpenNewTerminalModal}
        onSelect={handleSelectTerminal}
        onClose={handleCloseTerminal}
        onColorChange={handleColorChange}
      />

      <section className="terminal-pane">
        <div className="terminal-toolbar">
          <h1>{activeTerminal?.label ?? 'Terminale'}</h1>
          <span className="terminal-status">
            {activeTerminal ? activeTerminal.cwd : 'Nessun terminale attivo'}
          </span>
        </div>
        <div className="terminal-container">
          {activeId ? (
            <TerminalView
              activeId={activeId}
              terminals={terminals}
              onUserInput={handleTerminalInput}
              onOutput={handleTerminalOutput}
            />
          ) : (
            <div className="terminal-surface terminal-placeholder">
              Crea un nuovo terminale per iniziare a lavorare.
            </div>
          )}
        </div>
      </section>

      <FileExplorer
        path={explorerPath}
        entries={entries}
        loading={loadingExplorer}
        error={explorerError}
        onNavigate={handleNavigateDirectory}
        onNavigateUp={handleNavigateUp}
        onRefresh={handleRefreshExplorer}
        onOpenFile={handleOpenFilePreview}
      />

      <NewTerminalModal
        open={showNewTerminalModal}
        name={newTerminalName}
        path={newTerminalPath}
        color={newTerminalColor}
        availableColors={COLORS}
        selectingDirectory={selectingDirectory}
        creating={creatingTerminal}
        error={newTerminalError}
        onNameChange={setNewTerminalName}
        onColorChange={setNewTerminalColor}
        onBrowse={handleSelectDirectory}
        onCancel={handleCancelNewTerminal}
        onConfirm={handleConfirmNewTerminal}
      />

      <FilePreviewModal
        open={previewFile !== null}
        filename={previewFile?.name ?? null}
        content={previewContent}
        loading={loadingPreview}
        error={previewError}
        onClose={handleClosePreview}
      />
    </div>
  )
}

export default App
