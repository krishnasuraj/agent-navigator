import { useState, useEffect, useRef } from 'react'
import TerminalPanel from './components/TerminalPanel'
import StateLog from './components/StateLog'
import ResizableSplit from './components/ResizableSplit'

export default function App() {
  // ptySessionId: always set — the PTY shell connection
  // claudeActive: whether a Claude session is being tracked by the JSONL watcher
  const [ptySessionId, setPtySessionId] = useState(null)
  const [claudeActive, setClaudeActive] = useState(false)
  const spawned = useRef(false)

  // Spawn a shell on mount (not Claude — user starts Claude themselves)
  useEffect(() => {
    if (spawned.current) return
    spawned.current = true

    const id = `session-${Date.now()}`
    window.electronAPI.spawnSession(id, {})
      .then(() => setPtySessionId(id))
      .catch((err) => console.error('Failed to spawn session:', err))
  }, [])

  // Listen for Claude session lifecycle from JSONL watcher
  useEffect(() => {
    const removeStarted = window.electronAPI.onJsonlSessionStarted(() => {
      setClaudeActive(true)
    })
    const removeEnded = window.electronAPI.onJsonlSessionEnded(() => {
      setClaudeActive(false)
    })
    return () => {
      removeStarted()
      removeEnded()
    }
  }, [])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface-0">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 shrink-0" style={{ WebkitAppRegion: 'drag' }}>
        <span className="text-xs font-medium text-text-secondary">Claude Code Orchestrator</span>
      </div>

      <ResizableSplit
        left={<StateLog sessionId={claudeActive ? ptySessionId : null} />}
        right={<TerminalPanel sessionId={ptySessionId} />}
        defaultRatio={0.3}
        minLeftPx={250}
        minRightPx={400}
      />
    </div>
  )
}
