import { useCallback, useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

import type {
  TerminalDataEvent,
  TerminalExitEvent,
  TerminalInfo,
} from '../types'

interface TerminalViewProps {
  activeId: string | null
  terminals: TerminalInfo[]
  onUserInput: (id: string, data: string) => void
  onOutput: (id: string, data: string) => void
}

export default function TerminalView({ activeId, terminals, onUserInput, onOutput }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const terminalMapRef = useRef(new Map<string, Terminal>())
  const fitMapRef = useRef(new Map<string, FitAddon>())
  const viewMapRef = useRef(new Map<string, { element: HTMLDivElement; mounted: boolean }>())
  const activeRef = useRef<string | null>(null)
  const listenersRegisteredRef = useRef(false)
  const tauriAvailable =
    typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

  const reportResize = useCallback(async (id: string, terminal: Terminal) => {
    if (!tauriAvailable) {
      return
    }
    if (!terminal.rows || !terminal.cols) {
      return
    }

    try {
      await invoke('resize_terminal', {
        id,
        rows: terminal.rows,
        cols: terminal.cols,
      })
    } catch (error) {
      console.warn('Errore nel ridimensionare il terminale', error)
    }
  }, [tauriAvailable])

  const ensureTerminal = useCallback((id: string) => {
    let terminal = terminalMapRef.current.get(id)
    if (terminal) {
      return terminal
    }

    terminal = new Terminal({
      convertEol: true,
      fontFamily: '"IBM Plex Mono", "JetBrains Mono", Menlo, monospace',
      fontSize: 13,
      cursorBlink: true,
      allowTransparency: true,
      theme: {
        background: '#0f1115',
        foreground: '#f0f2f6',
        cursor: '#f28c52',
        selectionBackground: 'rgba(242, 140, 82, 0.38)',
      },
    })

    const fitAddon = new FitAddon()
    const linksAddon = new WebLinksAddon()
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(linksAddon)
    terminal.onData((chunk) => {
      onUserInput(id, chunk)
      void invoke('write_to_terminal', { id, data: chunk })
    })

    terminalMapRef.current.set(id, terminal)
    fitMapRef.current.set(id, fitAddon)
    const element = document.createElement('div')
    element.className = 'terminal-instance'
    viewMapRef.current.set(id, { element, mounted: false })
    return terminal
  }, [onUserInput])

  const attachTerminal = useCallback(
    (id: string | null) => {
      if (!tauriAvailable) {
        return
      }
      const container = containerRef.current
      if (!container) {
        return
      }

      container.innerHTML = ''
      activeRef.current = id

      if (!id) {
        return
      }

      const terminal = ensureTerminal(id)
      const fitAddon = fitMapRef.current.get(id)
      const viewEntry = viewMapRef.current.get(id)
      if (!viewEntry) {
        return
      }
      container.appendChild(viewEntry.element)
      if (!viewEntry.mounted) {
        terminal.open(viewEntry.element)
        viewEntry.mounted = true
      }
      const accent = terminals.find((item) => item.id === id)?.color ?? '#f28c52'
      terminal.options = {
        theme: {
          background: '#0f1115',
          foreground: '#f2f4f8',
          cursor: accent,
          cursorAccent: '#080a0d',
          selectionBackground: `${accent}55`,
        },
      }

      terminal.focus()

      requestAnimationFrame(() => {
        fitAddon?.fit()
        void reportResize(id, terminal)
      })
    },
    [ensureTerminal, reportResize, tauriAvailable, terminals],
  )

  useEffect(() => {
    if (!tauriAvailable || listenersRegisteredRef.current) {
      return
    }

    listenersRegisteredRef.current = true
    let cancelled = false
    const disposers: Array<() => void> = []

    const register = async () => {
      try {
        const dataListener = await listen<TerminalDataEvent>('terminal-data', (event) => {
          const term = ensureTerminal(event.payload.id)
          term.write(event.payload.data)
          onOutput(event.payload.id, event.payload.data)
        })
        if (cancelled) {
          dataListener()
        } else {
          disposers.push(dataListener)
        }

        const exitListener = await listen<TerminalExitEvent>('terminal-exit', (event) => {
          const term = terminalMapRef.current.get(event.payload.id)
          if (!term) {
            return
          }

          const { code, success, message } = event.payload
          const summary = message ?? (success
            ? `Processo completato (codice ${code})`
            : `Processo terminato con codice ${code}`)
          term.writeln(`\r\n${summary}\r\n`)
        })
        if (cancelled) {
          exitListener()
        } else {
          disposers.push(exitListener)
        }
      } catch (error) {
        console.error('Impossibile collegarsi agli eventi del terminale', error)
      }
    }

    void register()

    return () => {
      cancelled = true
      listenersRegisteredRef.current = false
      disposers.forEach((dispose) => dispose())
    }
  }, [ensureTerminal, onOutput, tauriAvailable])

  useEffect(() => {
    if (!tauriAvailable) {
      return
    }
    const validIds = new Set(terminals.map((item) => item.id))
    terminals.forEach((terminal) => {
      ensureTerminal(terminal.id)
    })

    Array.from(terminalMapRef.current.keys()).forEach((id) => {
      if (!validIds.has(id)) {
        terminalMapRef.current.get(id)?.dispose()
        terminalMapRef.current.delete(id)
        fitMapRef.current.delete(id)
        const viewEntry = viewMapRef.current.get(id)
        if (viewEntry) {
          viewEntry.element.remove()
          viewMapRef.current.delete(id)
        }
      }
    })
  }, [ensureTerminal, tauriAvailable, terminals])

  useEffect(() => {
    if (!tauriAvailable) {
      return
    }
    attachTerminal(activeId)
  }, [activeId, attachTerminal, tauriAvailable])

  useEffect(() => {
    if (!tauriAvailable) {
      return undefined
    }
    const container = containerRef.current
    if (!container) {
      return undefined
    }

    const handleResize = () => {
      const active = activeRef.current
      if (!active) {
        return
      }
      const fitAddon = fitMapRef.current.get(active)
      const terminal = terminalMapRef.current.get(active)
      const containerEl = containerRef.current
      if (!fitAddon || !terminal || !containerEl) {
        return
      }
      const rect = containerEl.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) {
        return
      }
      requestAnimationFrame(() => {
        fitAddon.fit()
        void reportResize(active, terminal)
      })
    }

    const observer = new ResizeObserver(handleResize)
    observer.observe(container)
    window.addEventListener('resize', handleResize)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', handleResize)
    }
  }, [reportResize, tauriAvailable])

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      const path = event.dataTransfer.getData('text/plain')
      if (!path || !activeId) {
        return
      }
      const terminal = terminalMapRef.current.get(activeId)
      if (!terminal) {
        return
      }
      // Aggiungi il path al terminale, con escape per spazi
      const escapedPath = path.includes(' ') ? `"${path}"` : path
      terminal.write(escapedPath)
      onUserInput(activeId, escapedPath)
      void invoke('write_to_terminal', { id: activeId, data: escapedPath })
    },
    [activeId, onUserInput],
  )

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  if (!tauriAvailable) {
    return (
      <div className="terminal-surface terminal-placeholder">
        Avvia l'app desktop Tauri per utilizzare il terminale integrato.
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="terminal-surface"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    />
  )
}
