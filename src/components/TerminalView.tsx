import { useCallback, useEffect, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

import AIAssistant from './AIAssistant'
import type {
  TerminalDataEvent,
  TerminalExitEvent,
  TerminalInfo,
  TerminalContext,
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
  const inputBufferRef = useRef<string>('')
  const recentCommandsRef = useRef<string[]>([])

  // Performance: buffer per batch processing dell'output
  const writeBufferRef = useRef(new Map<string, string[]>())
  const writeTimeoutRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  // Performance: buffer per terminali in background (non renderizzati)
  const backgroundBufferRef = useRef(new Map<string, string[]>())

  const tauriAvailable =
    typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

  // AI Assistant state
  const [showAIAssistant, setShowAIAssistant] = useState(false)
  const [aiIntent, setAiIntent] = useState('')
  const [aiContext, setAiContext] = useState<TerminalContext>({
    os: 'macos',
    shell: 'zsh',
    cwd: '',
    recentCommands: [],
  })

  // Performance: batch write con throttling per evitare troppi repaint
  const flushWriteBuffer = useCallback((id: string) => {
    const term = terminalMapRef.current.get(id)
    const buffer = writeBufferRef.current.get(id)

    if (!term || !buffer || buffer.length === 0) {
      return
    }

    // Scrivi tutto in una volta sola invece di N volte
    const chunk = buffer.join('')
    term.write(chunk)

    // Pulisci buffer
    writeBufferRef.current.set(id, [])
  }, [])

  const scheduleWrite = useCallback((id: string, data: string) => {
    // Performance: Se terminale NON è attivo, bufferizza senza scrivere a xterm
    if (id !== activeRef.current) {
      const bgBuffer = backgroundBufferRef.current.get(id) ?? []
      bgBuffer.push(data)
      backgroundBufferRef.current.set(id, bgBuffer)
      return // NON scrivere a xterm per terminali in background!
    }

    // Solo terminale attivo: aggiungi al buffer di scrittura
    const buffer = writeBufferRef.current.get(id) ?? []
    buffer.push(data)
    writeBufferRef.current.set(id, buffer)

    // Cancella timer precedente se esiste
    const existingTimeout = writeTimeoutRef.current.get(id)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    // Performance: Batch ADATTIVO basato sulla dimensione del chunk
    // - Piccoli chunk (< 100 chars, probabile echo utente): flush immediato (1ms)
    // - Grandi chunk (output massiccio): batch più lungo (32ms) per meno repaint
    const isSmallChunk = data.length < 100
    const batchDelay = isSmallChunk ? 1 : 32

    const timeout = setTimeout(() => {
      flushWriteBuffer(id)
      writeTimeoutRef.current.delete(id)
    }, batchDelay)

    writeTimeoutRef.current.set(id, timeout)
  }, [flushWriteBuffer])

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
      scrollOnUserInput: true,
      // Performance: scrollback ridotto da 10000 a 5000 per rendering più veloce
      scrollback: 5000,
      fastScrollModifier: 'shift',
      // Performance: rendering ottimizzato
      windowOptions: {
        setWinSizeChars: true,
      },
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
      // Check if user pressed # to trigger AI assistant
      if (chunk === '#' && inputBufferRef.current.trim().length > 0) {
        const intent = inputBufferRef.current.trim()
        const activeTerminal = terminals.find((t) => t.id === id)

        setAiIntent(intent)
        setAiContext({
          os: 'macos', // TODO: detect OS dynamically
          shell: 'zsh', // TODO: detect shell from terminal
          cwd: activeTerminal?.cwd || '',
          recentCommands: recentCommandsRef.current.slice(-5),
        })
        setShowAIAssistant(true)

        // Clear input buffer
        inputBufferRef.current = ''
        return // Don't send # to terminal
      }

      // Track input buffer for AI context
      if (chunk === '\r' || chunk === '\n') {
        // Command submitted - save to recent commands
        const cmd = inputBufferRef.current.trim()
        if (cmd.length > 0) {
          recentCommandsRef.current = [...recentCommandsRef.current.slice(-9), cmd]
        }
        inputBufferRef.current = ''
      } else if (chunk === '\x7f' || chunk === '\b') {
        // Backspace - remove last char from buffer
        inputBufferRef.current = inputBufferRef.current.slice(0, -1)
      } else if (chunk.length === 1 && chunk.charCodeAt(0) >= 32) {
        // Printable character - add to buffer
        inputBufferRef.current += chunk
      }

      onUserInput(id, chunk)
      void invoke('write_to_terminal', { id, data: chunk })
    })

    // Performance: throttled auto-scroll invece di ogni write
    let scrollTimeout: ReturnType<typeof setTimeout> | null = null
    terminal.onWriteParsed(() => {
      if (scrollTimeout) return

      scrollTimeout = setTimeout(() => {
        const buffer = terminal.buffer.active
        const distanceFromBottom = buffer.baseY - buffer.viewportY

        // Auto-scroll solo se entro 5 righe dal bottom
        if (distanceFromBottom <= 5) {
          terminal.scrollToBottom()
        }
        scrollTimeout = null
      }, 50) // Scroll max ogni 50ms invece che ad ogni carattere
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

      // Performance: Flush buffer background quando terminale diventa attivo
      const bgBuffer = backgroundBufferRef.current.get(id)
      if (bgBuffer && bgBuffer.length > 0) {
        const combined = bgBuffer.join('')
        terminal.write(combined)
        backgroundBufferRef.current.delete(id)
      }

      terminal.focus()

      // Aspetta che il DOM sia completamente renderizzato prima del fit
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          fitAddon?.fit()
          void reportResize(id, terminal)
        })
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
          ensureTerminal(event.payload.id)

          // Performance: usa batch write invece di write immediato
          scheduleWrite(event.payload.id, event.payload.data)
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
            ? `Process completed (code ${code})`
            : `Process finished with code ${code}`)
          term.writeln(`\r\n${summary}\r\n`)
        })
        if (cancelled) {
          exitListener()
        } else {
          disposers.push(exitListener)
        }
      } catch (error) {
        console.error('Unable to attach terminal events', error)
      }
    }

    void register()

    return () => {
      cancelled = true
      listenersRegisteredRef.current = false
      disposers.forEach((dispose) => dispose())
    }
  }, [ensureTerminal, onOutput, scheduleWrite, tauriAvailable])

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
        // Performance: cleanup dei buffer quando terminale viene chiuso
        const timeout = writeTimeoutRef.current.get(id)
        if (timeout) {
          clearTimeout(timeout)
          writeTimeoutRef.current.delete(id)
        }
        flushWriteBuffer(id) // Flush eventuali dati pendenti prima di chiudere
        writeBufferRef.current.delete(id)
        backgroundBufferRef.current.delete(id) // Pulisci anche background buffer

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
  }, [ensureTerminal, flushWriteBuffer, tauriAvailable, terminals])

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

    let resizeTimeout: ReturnType<typeof setTimeout> | null = null
    let isResizing = false
    let lastRows = 0
    let lastCols = 0
    let observer: ResizeObserver | null = null

    const handleResize = () => {
      const active = activeRef.current
      if (!active) {
        return
      }

      // Non fare resize se siamo già in resize
      if (isResizing) {
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

      // Debounce
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }

      resizeTimeout = setTimeout(() => {
        // Previeni re-entry
        isResizing = true

        // DISCONNETTI l'observer prima del fit per evitare loop
        if (observer) {
          observer.disconnect()
        }

        requestAnimationFrame(() => {
          fitAddon.fit()

          // Report resize solo se rows/cols sono cambiati
          const currentRows = terminal.rows
          const currentCols = terminal.cols
          if (currentRows !== lastRows || currentCols !== lastCols) {
            lastRows = currentRows
            lastCols = currentCols
            void reportResize(active, terminal)
          }

          // RICONNETTI l'observer dopo il fit
          setTimeout(() => {
            if (observer && containerEl) {
              observer.observe(containerEl)
            }
            isResizing = false
          }, 150)
        })
      }, 200)
    }

    observer = new ResizeObserver(handleResize)
    observer.observe(container)
    window.addEventListener('resize', handleResize)

    return () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }
      if (observer) {
        observer.disconnect()
      }
      window.removeEventListener('resize', handleResize)
    }
  }, [reportResize, tauriAvailable])


  const handleAICommandSelect = useCallback((command: string) => {
    if (!activeId) return

    const terminal = terminalMapRef.current.get(activeId)
    if (!terminal) return

    // Write command to terminal and execute it
    terminal.write(command + '\r')
    void invoke('write_to_terminal', { id: activeId, data: command + '\r' })

    // Add to recent commands
    recentCommandsRef.current = [...recentCommandsRef.current.slice(-9), command]
  }, [activeId])

  if (!tauriAvailable) {
    return (
      <div className="terminal-surface terminal-placeholder">
        Avvia l'app desktop Tauri per utilizzare il terminale integrato.
      </div>
    )
  }

  return (
    <>
      <div
        ref={containerRef}
        className="terminal-surface"
        style={{ overflow: 'hidden' }}
      />

      {showAIAssistant && (
        <AIAssistant
          intent={aiIntent}
          context={aiContext}
          onClose={() => setShowAIAssistant(false)}
          onSelectCommand={handleAICommandSelect}
        />
      )}
    </>
  )
}
