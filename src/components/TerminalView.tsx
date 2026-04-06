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

interface TerminalScrollState {
  autoScrollEnabled: boolean
  lastScrollTop: number
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

  // Performance: buffer per batch processing dell'output
  const writeBufferRef = useRef(new Map<string, string[]>())
  const writeTimeoutRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  // Performance: buffer per terminali in background (non renderizzati)
  const backgroundBufferRef = useRef(new Map<string, string[]>())

  // Tracking paragrafi arancioni: se siamo dentro un paragrafo che inizia con bullet point
  const inOrangeParagraphRef = useRef(false)

  // Smart Scroll: stato per ogni terminale (autoscroll abilitato/disabilitato)
  const scrollStateRef = useRef(new Map<string, TerminalScrollState>())
  const [showScrollBadge, setShowScrollBadge] = useState(false)

  // Safety: track component mount state to prevent async operations after unmount
  const mountedRef = useRef(true)

  const tauriAvailable =
    typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

  // Safety: set mounted flag on mount and cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      // Clear all pending write timeouts
      writeTimeoutRef.current.forEach((timeout) => clearTimeout(timeout))
      writeTimeoutRef.current.clear()
    }
  }, [])

  // Helper: ottieni o inizializza scroll state per un terminale
  const getScrollState = useCallback((id: string): TerminalScrollState => {
    let state = scrollStateRef.current.get(id)
    if (!state) {
      state = { autoScrollEnabled: true, lastScrollTop: 0 }
      scrollStateRef.current.set(id, state)
    }
    return state
  }, [])

  // Helper: check se il viewport è vicino al bottom (entro N righe)
  const isNearBottom = useCallback((terminal: Terminal, threshold: number = 3): boolean => {
    if (!terminal.buffer || !terminal.buffer.active) return true
    const viewport = terminal.buffer.active.viewportY
    const baseY = terminal.buffer.active.baseY
    const totalLines = baseY + terminal.rows
    const distanceFromBottom = totalLines - (viewport + terminal.rows)
    return distanceFromBottom <= threshold
  }, [])

  // Handler: scroll al bottom e riabilita autoscroll
  const handleScrollToBottom = useCallback(() => {
    // Safety: check component is still mounted
    if (!mountedRef.current) return
    if (!activeRef.current) return
    const terminal = terminalMapRef.current.get(activeRef.current)
    if (!terminal) return

    // Defensive check: verify container still exists in DOM
    const container = containerRef.current
    if (!container || !document.body.contains(container)) {
      return
    }

    // Defensive check: verify terminal element still exists
    const viewEntry = viewMapRef.current.get(activeRef.current)
    if (!viewEntry || !viewEntry.element || !document.body.contains(viewEntry.element)) {
      return
    }

    try {
      const scrollState = getScrollState(activeRef.current)
      scrollState.autoScrollEnabled = true
      scrollStateRef.current.set(activeRef.current, scrollState)
      terminal.scrollToBottom()
      setShowScrollBadge(false)
    } catch (error) {
      // Catch any DOM errors to prevent crash
      console.warn('Error scrolling to bottom:', error)
      setShowScrollBadge(false)
    }
  }, [getScrollState])

  // Filtro righe vuote eccessive SOLO per output massiccio (es. Claude Code)
  // Ma preserva formatting normale dell'utente
  const cleanEmptyLines = useCallback((data: string): string => {
    // NON filtrare se è input breve dell'utente (< 200 chars)
    if (data.length < 200) {
      return data
    }

    // Solo per output lungo: riduci sequenze di 3+ newline → 2 newline (1 riga vuota max)
    // Questo preserva paragrafi ma evita "muri" di spazio vuoto
    return data
      .replace(/(\r?\n){3,}/g, '\n\n')  // 3+ newline → 2 newline (1 riga vuota visibile)
  }, [])

  // Formattazione righe output Claude Code con colori diversi e block markers
  const formatQuoteLines = useCallback((data: string): string => {
    // ANSI codes per badge "Jack" con sfondo arancione
    const orangeBadge = '\x1b[48;5;208m\x1b[38;5;16m\x1b[1m' // bg arancione, testo nero, bold
    const reset = '\x1b[0m'
    // ANSI code per separatore block (linea orizzontale sottile grigio scuro)
    const blockSeparator = '\x1b[2m\x1b[90m' + '─'.repeat(80) + reset

    // Splitta per righe preservando i delimitatori
    const lines = data.split(/(\r?\n)/)

    const formatted = lines.map((line, index) => {
      // Salta i delimitatori (newline)
      if (line === '\r\n' || line === '\n' || line === '\r') {
        return line
      }

      // Rimuovi codici ANSI esistenti per il check
      // eslint-disable-next-line no-control-regex
      const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '')
      const trimmed = cleanLine.trim()

      // Se la riga contiene "#" → termina paragrafo Jack
      if (trimmed.includes('#')) {
        inOrangeParagraphRef.current = false
        return line // Lascia la riga con # normale
      }

      // Se la riga inizia con ">" (user input) → aggiungi block separator prima
      if (trimmed.startsWith('>')) {
        // Aggiungi separatore solo se non è la prima riga
        const separator = index > 0 ? `\r\n${blockSeparator}\r\n` : ''
        return separator + line
      }

      // Se la riga contiene "●" o "•" (bullet points di Claude Code) → inizia paragrafo Jack
      if (cleanLine.includes('●') || cleanLine.includes('•') || cleanLine.includes('⏺')) {
        inOrangeParagraphRef.current = true
        // Rimuovi pallino + papera fuori + spazio + badge "Jack" con sfondo arancione
        const withJackBadge = cleanLine
          .replace('●', `🦆  ${orangeBadge} Jack ${reset}`)
          .replace('•', `🦆  ${orangeBadge} Jack ${reset}`)
          .replace('⏺', `🦆  ${orangeBadge} Jack ${reset}`)
        return withJackBadge
      }

      // Righe successive nel paragrafo → continua normale (senza badge)
      return line
    })

    return formatted.join('')
  }, [])

  // Performance: batch write con throttling per evitare troppi repaint
  const flushWriteBuffer = useCallback((id: string) => {
    // Safety: check component is still mounted
    if (!mountedRef.current) {
      // Clean up buffer if unmounted
      writeBufferRef.current.set(id, [])
      return
    }

    const term = terminalMapRef.current.get(id)
    const buffer = writeBufferRef.current.get(id)

    if (!term || !buffer || buffer.length === 0) {
      return
    }

    // Defensive check: verify terminal element still exists
    const viewEntry = viewMapRef.current.get(id)
    if (!viewEntry || !viewEntry.element || !document.body.contains(viewEntry.element)) {
      // Clean up buffer even if element is gone
      writeBufferRef.current.set(id, [])
      return
    }

    try {
      // Scrivi tutto in una volta sola invece di N volte
      const chunk = buffer.join('')
      term.write(chunk)
    } catch (error) {
      // Catch any DOM errors to prevent crash
      console.warn('Error writing to terminal:', error)
    } finally {
      // Pulisci buffer
      writeBufferRef.current.set(id, [])
    }
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
    // - Grandi chunk (output massiccio): batch ottimizzato (8ms) per output fluido senza "tagli"
    const isSmallChunk = data.length < 100
    const batchDelay = isSmallChunk ? 1 : 8

    const timeout = setTimeout(() => {
      flushWriteBuffer(id)
      writeTimeoutRef.current.delete(id)
    }, batchDelay)

    writeTimeoutRef.current.set(id, timeout)
  }, [flushWriteBuffer])

  // Track the last reported dimensions to avoid redundant/wrong resizes
  const lastReportedDimensionsRef = useRef(new Map<string, { rows: number; cols: number }>())

  const reportResize = useCallback(async (id: string, terminal: Terminal) => {
    if (!tauriAvailable) {
      return
    }
    if (!terminal.rows || !terminal.cols) {
      return
    }

    // CRITICAL FIX: Ignore default dimensions (24x80) that XTerm returns before mounting
    // These are almost certainly wrong and would cause Claude Code to think the terminal is tiny
    if (terminal.rows === 24 && terminal.cols <= 80) {
      console.log(`[TerminalView] IGNORING default dimensions (24x80) for ${id}`)
      return
    }

    // Also ignore very small dimensions that are likely invalid
    if (terminal.rows < 10 || terminal.cols < 40) {
      console.log(`[TerminalView] IGNORING too-small dimensions (${terminal.rows}x${terminal.cols}) for ${id}`)
      return
    }

    // Check if dimensions have actually changed from last report
    const lastDims = lastReportedDimensionsRef.current.get(id)
    if (lastDims && lastDims.rows === terminal.rows && lastDims.cols === terminal.cols) {
      // Same dimensions, skip redundant resize
      return
    }

    // Store new dimensions
    lastReportedDimensionsRef.current.set(id, { rows: terminal.rows, cols: terminal.cols })

    try {
      console.log(`[TerminalView] resize_terminal(${id}, rows=${terminal.rows}, cols=${terminal.cols})`)
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
      // Unicode: supporto completo per emoji e caratteri speciali
      allowProposedApi: true,
      // Performance: rendering ottimizzato
      windowOptions: {
        setWinSizeChars: true,
      },
      theme: {
        background: '#000000', // Classic black background
        foreground: '#00ff00', // Classic green text (like old terminals)
        cursor: '#00ff00', // Green cursor
        selectionBackground: 'rgba(0, 255, 0, 0.3)', // Green selection
        // Classic terminal colors
        black: '#000000',
        red: '#cd0000',
        green: '#00cd00',
        yellow: '#cdcd00',
        blue: '#0000ee',
        magenta: '#cd00cd',
        cyan: '#00cdcd',
        white: '#e5e5e5',
        brightBlack: '#7f7f7f',
        brightRed: '#ff0000',
        brightGreen: '#00ff00',
        brightYellow: '#ffff00',
        brightBlue: '#5c5cff',
        brightMagenta: '#ff00ff',
        brightCyan: '#00ffff',
        brightWhite: '#ffffff',
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

    // Smart Auto-scroll: scorre solo se autoscroll è abilitato
    terminal.onWriteParsed(() => {
      const scrollState = getScrollState(id)
      if (scrollState.autoScrollEnabled) {
        terminal.scrollToBottom()
      }
    })

    // Listener per scroll manuale: disabilita/riabilita autoscroll
    terminal.onScroll(() => {
      const scrollState = getScrollState(id)
      const nearBottom = isNearBottom(terminal, 3)
      const farFromBottom = !isNearBottom(terminal, 10)

      // Se utente scrolla SU (>10 righe dal bottom) → disabilita autoscroll
      if (farFromBottom && scrollState.autoScrollEnabled) {
        scrollState.autoScrollEnabled = false
        scrollStateRef.current.set(id, scrollState)
        // Mostra badge solo per terminale attivo
        if (id === activeRef.current) {
          setShowScrollBadge(true)
        }
      }

      // Se utente scrolla GIÙ (vicino al bottom <3 righe) → riabilita autoscroll
      if (nearBottom && !scrollState.autoScrollEnabled) {
        scrollState.autoScrollEnabled = true
        scrollStateRef.current.set(id, scrollState)
        // Nascondi badge
        if (id === activeRef.current) {
          setShowScrollBadge(false)
        }
      }
    })

    terminalMapRef.current.set(id, terminal)
    fitMapRef.current.set(id, fitAddon)
    const element = document.createElement('div')
    element.className = 'terminal-instance'
    viewMapRef.current.set(id, { element, mounted: false })

    // NOTE: Do NOT resize here - terminal is not mounted yet and will return wrong dimensions (24x80)
    // The resize will happen in attachTerminal when the terminal is properly mounted

    return terminal
  }, [onUserInput, getScrollState, isNearBottom])

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
      const accent = terminals.find((item) => item.id === id)?.color ?? 'var(--accent-color)'
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

      // Defensive focus: only if element exists in DOM
      try {
        if (viewEntry.element && document.body.contains(viewEntry.element)) {
          terminal.focus()
        }
      } catch (error) {
        console.warn('Error focusing terminal:', error)
      }

      // SIMPLIFIED: Single resize after terminal is attached
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        if (!mountedRef.current) return
        if (!fitAddon || !terminal || !containerRef.current) return
        if (!document.body.contains(containerRef.current)) return

        try {
          fitAddon.fit()
          void reportResize(id, terminal)
        } catch (error) {
          console.warn('Error during terminal fit:', error)
        }
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

        // Smart Scroll: pulisci scroll state
        scrollStateRef.current.delete(id)

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

    // Smart Scroll: aggiorna visibilità badge quando cambia terminale attivo
    if (activeId) {
      const scrollState = getScrollState(activeId)
      setShowScrollBadge(!scrollState.autoScrollEnabled)
    } else {
      setShowScrollBadge(false)
    }
  }, [activeId, attachTerminal, tauriAvailable, getScrollState])

  useEffect(() => {
    if (!tauriAvailable) {
      return undefined
    }
    const container = containerRef.current
    if (!container) {
      return undefined
    }

    let resizeTimeout: ReturnType<typeof setTimeout> | null = null
    let lastRows = 0
    let lastCols = 0
    let observer: ResizeObserver | null = null
    let initialResizeDone = false

    // CRITICAL FIX: Use proposeDimensions() + resize() instead of fit()
    // This workaround fixes XTerm.js bug where fit() doesn't calculate dimensions correctly
    const doManualFitResize = (fit: FitAddon, term: Terminal): boolean => {
      try {
        const dims = fit.proposeDimensions()
        if (dims && dims.cols && dims.rows && !isNaN(dims.cols) && !isNaN(dims.rows)) {
          const cols = Math.max(dims.cols, 40)
          const rows = Math.max(dims.rows, 10)
          term.resize(cols, rows)
          return true
        }
      } catch {
        // Ignore
      }
      return false
    }

    const doFit = () => {
      const active = activeRef.current
      if (!active) return

      const fitAddon = fitMapRef.current.get(active)
      const terminal = terminalMapRef.current.get(active)

      if (!fitAddon || !terminal || !containerRef.current) return
      if (!document.body.contains(containerRef.current)) return

      try {
        // Use manual fit for better accuracy
        if (!doManualFitResize(fitAddon, terminal)) {
          fitAddon.fit() // Fallback
        }

        const currentRows = terminal.rows
        const currentCols = terminal.cols
        if (currentRows !== lastRows || currentCols !== lastCols) {
          lastRows = currentRows
          lastCols = currentCols
          void reportResize(active, terminal)
        }
      } catch (error) {
        console.warn('Error during terminal resize:', error)
      }
    }

    const handleResize = () => {
      const active = activeRef.current
      if (!active) {
        return
      }

      const fitAddon = fitMapRef.current.get(active)
      const terminal = terminalMapRef.current.get(active)
      const containerEl = containerRef.current

      // Defensive null checks to prevent NotFoundError
      if (!fitAddon || !terminal || !containerEl) {
        return
      }

      // Check if container is still in DOM
      if (!document.body.contains(containerEl)) {
        return
      }

      const rect = containerEl.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) {
        return
      }

      // For initial resize, do it immediately without debounce
      // This is critical for new windows where dimensions aren't stable initially
      if (!initialResizeDone) {
        initialResizeDone = true
        requestAnimationFrame(() => {
          if (!mountedRef.current) return
          doFit()
          // Also schedule a second fit after a short delay to catch any late layout changes
          setTimeout(() => {
            if (mountedRef.current) doFit()
          }, 100)
        })
        return
      }

      // Debounce subsequent resize operations (reduced from 200ms to 50ms)
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }

      resizeTimeout = setTimeout(() => {
        // Safety: check if unmounted
        if (!mountedRef.current) return

        // Re-check validity before executing (container might have been removed)
        if (!containerRef.current || !document.body.contains(containerRef.current)) {
          return
        }

        requestAnimationFrame(() => {
          // Safety: check if unmounted
          if (!mountedRef.current) return
          doFit()
        })
      }, 50)
    }

    observer = new ResizeObserver((entries) => {
      // Check if entries are valid before processing
      if (!entries || entries.length === 0) {
        return
      }

      // Check if observed element is still in DOM
      const entry = entries[0]
      if (!entry || !entry.target || !document.body.contains(entry.target as Node)) {
        return
      }

      handleResize()
    })

    observer.observe(container)
    window.addEventListener('resize', handleResize)

    return () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
        resizeTimeout = null
      }
      if (observer) {
        observer.disconnect()
        observer = null
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
      {showScrollBadge && (
        <button
          className="terminal-scroll-badge"
          onClick={handleScrollToBottom}
          title="Scroll to bottom"
        >
          ↓ Scroll to bottom
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
