import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'

export function useTerminal(taskId) {
  const termRef = useRef(null)
  const [container, setContainer] = useState(null)

  const containerCallbackRef = useCallback((node) => {
    setContainer(node)
  }, [])

  useEffect(() => {
    if (!taskId || !container) return

    const term = new Terminal({
      cursorBlink: true,
      disableStdin: false,
      fontSize: 13,
      fontFamily: '"JetBrains Mono", monospace',
      lineHeight: 1.4,
      theme: {
        background: '#0a0a0f',
        foreground: '#e4e4ed',
        cursor: '#e4e4ed',
        selectionBackground: '#3a3a5580',
        black: '#0a0a0f',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#e4e4ed',
        brightBlack: '#5c5c78',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#f5f5ff',
      },
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(container)

    try {
      const webglAddon = new WebglAddon()
      term.loadAddon(webglAddon)
    } catch {
      // WebGL not available, fall back to canvas
    }

    termRef.current = term

    // Delay fit until the browser has laid out the container.
    // Without this, the container may have 0x0 dimensions and fit() silently no-ops.
    const rafId = requestAnimationFrame(() => {
      try {
        fitAddon.fit()
        window.electronAPI.sendTerminalResize(taskId, term.cols, term.rows)
      } catch {
        // ignore fit errors during layout
      }
    })

    // Forward keystrokes to PTY via IPC
    const onDataDispose = term.onData((data) => {
      window.electronAPI.sendTerminalInput(taskId, data)
    })

    // The shell likely already printed its prompt before we subscribed.
    // Send a no-op redraw to make the shell re-render its prompt line.
    // Ctrl+L clears and redraws in most shells without side effects.
    window.electronAPI.sendTerminalInput(taskId, '\x0c')

    // Subscribe to terminal output from main process
    const removeListener = window.electronAPI.onTerminalData(taskId, (data) => {
      term.write(data)
    })

    // Handle resize — refit terminal and notify PTY
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit()
        window.electronAPI.sendTerminalResize(taskId, term.cols, term.rows)
      } catch {
        // Ignore resize errors during disposal
      }
    })
    resizeObserver.observe(container)

    return () => {
      cancelAnimationFrame(rafId)
      resizeObserver.disconnect()
      onDataDispose.dispose()
      removeListener()
      term.dispose()
      termRef.current = null
    }
  }, [taskId, container])

  return containerCallbackRef
}
