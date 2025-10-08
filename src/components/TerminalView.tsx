import { memo, useCallback, useEffect, useRef, useState } from 'react'
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
  onUpdateRecentCommands: (commands: string[]) => void
}

function TerminalView({ activeId, terminals, onUserInput, onOutput, onUpdateRecentCommands }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const terminalMapRef = useRef(new Map<string, Terminal>())
  const fitMapRef = useRef(new Map<string, FitAddon>())
  const viewMapRef = useRef(new Map<string, { element: HTMLDivElement; mounted: boolean }>())
  const activeRef = useRef<string | null>(null)
  const listenersRegisteredRef = useRef(false)
  const inputBufferRef = useRef<string>('')
  const recentCommandsRef = useRef<string[]>([])

  // Smart scroll: tracking per auto-scroll state
  const autoScrollEnabledRef = useRef(new Map<string, boolean>())
  const userScrollPositionRef = useRef(new Map<string, number>())
  const scrollCheckTimeoutRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const [scrollBadgeVisible, setScrollBadgeVisible] = useState<string | null>(null)

  // Performance: buffer per batch processing dell'output
  const writeBufferRef = useRef(new Map<string, string[]>())
  const writeTimeoutRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  // Performance: buffer per terminali in background (non renderizzati)
  const backgroundBufferRef = useRef(new Map<string, string[]>())

  const tauriAvailable =
    typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

  // Filtro righe vuote eccessive (per Claude Code e output verboso)
  const cleanEmptyLines = useCallback((data: string): string => {
    // Sostituisci sequenze di 3+ newline consecutive con max 2 newline
    // Supporta sia \n che \r\n
    return data
      .replace(/(\r?\n){3,}/g, '\n\n')  // 3+ newline → 2 newline (max 1 riga vuota)
  }, [])

  // Formattazione righe output Claude Code con colori diversi
  const formatQuoteLines = useCallback((data: string): string => {
    // ANSI codes:
    // Arancione 208 (256 colors) simile a #f28c52 per bullet points
    const orangeBg = '\x1b[48;5;208m\x1b[38;5;16m\x1b[1m'
    // Blu pastello RGB (143, 166, 255) = #8fa6ff per righe con ">"
    const pastelBlueBg = '\x1b[48;2;143;166;255m\x1b[38;2;0;0;0m\x1b[1m'
    const reset = '\x1b[0m'

    // Splitta per righe preservando i delimitatori
    const lines = data.split(/(\r?\n)/)

    const formatted = lines.map((line) => {
      // Salta i delimitatori (newline)
      if (line === '\r\n' || line === '\n' || line === '\r') {
        return line
      }

      // Rimuovi codici ANSI esistenti per il check
      // eslint-disable-next-line no-control-regex
      const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '')
      const trimmed = cleanLine.trim()

      // Se la riga contiene "●" o "•" (bullet points di Claude Code) → arancione
      if (line.includes('●') || line.includes('•') || line.includes('⏺')) {
        return `${orangeBg}${cleanLine}${reset}`
      }

      // Se la riga inizia con ">" → blu pastello
      if (trimmed.startsWith('>')) {
        return `${pastelBlueBg}${cleanLine}${reset}`
      }

      return line
    })

    return formatted.join('')
  }, [])

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
    // - Grandi chunk (output massiccio): batch ridotto (16ms invece di 32ms) per evitare spazi vuoti con Claude Code
    const isSmallChunk = data.length < 100
    const batchDelay = isSmallChunk ? 1 : 16

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
        background: 'rgba(15, 17, 21, 0.2)',
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
      // Track input buffer and commands for AI context
      if (chunk === '\r' || chunk === '\n') {
        const cmd = inputBufferRef.current.trim();
        if (cmd.length > 0) {
          recentCommandsRef.current = [...recentCommandsRef.current.slice(-9), cmd];
          onUpdateRecentCommands(recentCommandsRef.current);
        }
        inputBufferRef.current = '';
      } else if (chunk === '\x7f' || chunk === '\b') {
        if (inputBufferRef.current.length > 0) {
          inputBufferRef.current = inputBufferRef.current.slice(0, -1);
        }
      } else if (chunk.length === 1 && chunk.charCodeAt(0) >= 32) {
        inputBufferRef.current += chunk;
      }

      // Send to terminal
      onUserInput(id, chunk);
      void invoke('write_to_terminal', { id, data: chunk });
    })

    // Smart scroll: registra listener per detectare scroll utente
    terminal.onScroll(() => {
      handleUserScroll(id, terminal)
    })

    // Performance: throttled auto-scroll invece di ogni write
    let scrollTimeout: ReturnType<typeof setTimeout> | null = null
    terminal.onWriteParsed(() => {
      if (scrollTimeout) return

      scrollTimeout = setTimeout(() => {
        // Smart scroll: Check se auto-scroll è abilitato per questo terminale
        const autoScrollEnabled = autoScrollEnabledRef.current.get(id) ?? true
        if (!autoScrollEnabled) {
          scrollTimeout = null
          return // Skip auto-scroll se utente ha scrollato UP
        }

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

  // Smart scroll: detectare user scroll gesture e gestire auto-scroll state (con throttling)
  const handleUserScroll = useCallback((id: string, terminal: Terminal) => {
    // Throttle: check solo ogni 150ms per evitare troppi re-render durante output massiccio
    const existingTimeout = scrollCheckTimeoutRef.current.get(id)
    if (existingTimeout) {
      return // Skip se già c'è un check in corso
    }

    const timeout = setTimeout(() => {
      const buffer = terminal.buffer.active
      const distanceFromBottom = buffer.baseY - buffer.viewportY

      // Se utente scrolla UP di più di 10 righe → disabilita auto-scroll
      if (distanceFromBottom > 10) {
        const wasEnabled = autoScrollEnabledRef.current.get(id) ?? true
        if (wasEnabled) {
          autoScrollEnabledRef.current.set(id, false)
          // Mostra badge solo se questo è il terminale attivo
          if (id === activeRef.current) {
            setScrollBadgeVisible(id)
          }
        }
      }

      // Se utente torna entro 3 righe dal bottom → ri-abilita auto-scroll
      if (distanceFromBottom <= 3) {
        const wasDisabled = !(autoScrollEnabledRef.current.get(id) ?? true)
        if (wasDisabled) {
          autoScrollEnabledRef.current.set(id, true)
          // Nascondi badge
          setScrollBadgeVisible(null)
        }
      }

      // Memorizza posizione corrente
      userScrollPositionRef.current.set(id, buffer.viewportY)
      scrollCheckTimeoutRef.current.delete(id)
    }, 150)

    scrollCheckTimeoutRef.current.set(id, timeout)
  }, [])

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
          background: 'rgba(15, 17, 21, 0.2)',
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

          // Filtra righe vuote eccessive e formatta righe con ">"
          let processedData = cleanEmptyLines(event.payload.data)
          processedData = formatQuoteLines(processedData)

          // Performance: usa batch write invece di write immediato
          scheduleWrite(event.payload.id, processedData)
          onOutput(event.payload.id, processedData)
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
  }, [ensureTerminal, onOutput, scheduleWrite, tauriAvailable, cleanEmptyLines, formatQuoteLines])

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

        // Smart scroll: cleanup scroll state refs
        const scrollTimeout = scrollCheckTimeoutRef.current.get(id)
        if (scrollTimeout) {
          clearTimeout(scrollTimeout)
          scrollCheckTimeoutRef.current.delete(id)
        }
        autoScrollEnabledRef.current.delete(id)
        userScrollPositionRef.current.delete(id)

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
      style={{ overflow: 'hidden', position: 'relative' }}
    >
      {scrollBadgeVisible === activeId && activeId && (
        <button
          type="button"
          className="scroll-to-bottom-badge"
          onClick={() => {
            const terminal = terminalMapRef.current.get(activeId)
            if (terminal) {
              terminal.scrollToBottom()
              autoScrollEnabledRef.current.set(activeId, true)
              setScrollBadgeVisible(null)
            }
          }}
        >
          ⬇ Scroll to bottom
        </button>
      )}
    </div>
  )
}

// Performance: Memo con comparatore custom per evitare re-render quando cambia solo git/explorer
export default memo(TerminalView, (prevProps, nextProps) => {
  // Re-render solo se activeId o terminals array cambiano effettivamente
  if (prevProps.activeId !== nextProps.activeId) return false
  if (prevProps.terminals.length !== nextProps.terminals.length) return false

  // Check se i terminali sono cambiati (shallow comparison sufficiente)
  // PERFORMANCE FIX: Non controllare 'status' perché TerminalView non lo usa!
  // Status è solo per la sidebar, ma causava re-render completi ad ogni keystroke
  for (let i = 0; i < prevProps.terminals.length; i++) {
    const prev = prevProps.terminals[i]
    const next = nextProps.terminals[i]
    if (prev.id !== next.id || prev.color !== next.color) {
      return false
    }
  }

  // Callbacks sono già stabili grazie a useCallback in App.tsx
  return true // Props uguali, skippa re-render
})
