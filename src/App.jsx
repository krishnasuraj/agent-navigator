import { useState, useEffect, useRef, useCallback } from 'react'
import TerminalPanel from './components/TerminalPanel'
import StateLog from './components/StateLog'
import SessionList from './components/SessionList'
import ResizableSplit from './components/ResizableSplit'
import KanbanBoard from './components/KanbanBoard'

export default function App() {
  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [showNewAgent, setShowNewAgent] = useState(false)
  const [view, setView] = useState('agent') // 'agent' | 'board'
  const [branchInput, setBranchInput] = useState('')
  const spawned = useRef(false)

  const spawnAgent = useCallback(async (branch, cwd) => {
    const id = `session-${Date.now()}`
    setSessions(prev => [...prev, {
      id, name: branch, branch, claudeActive: false, state: null, lastEvent: null,
    }])
    setActiveSessionId(id)
    try {
      await window.electronAPI.spawnSession(id, { cwd })
    } catch (err) {
      console.error('Failed to spawn session:', err)
    }
  }, [])

  // Auto-spawn on mount (test mode or single default session)
  useEffect(() => {
    if (spawned.current) return
    spawned.current = true

    const TEST_PROMPTS = [
      'write a haiku about the ocean and save it to haiku.txt',
      'write a limerick about coding and save it to limerick.txt',
      'write a sonnet about the moon and save it to sonnet.txt',
      'list the files in this directory and describe what you see',
      'write a short joke about recursion and save it to joke.txt',
    ]

    window.electronAPI.getTestConfig().then(({ testSessions, testCwds, testBranches }) => {
      if (testSessions > 0) {
        for (let i = 0; i < testSessions; i++) {
          const prompt = TEST_PROMPTS[i % TEST_PROMPTS.length]
          setTimeout(() => {
            const id = `session-${Date.now()}`
            const branch = testBranches[i]
            setSessions(prev => [...prev, {
              id, name: branch, branch, claudeActive: false, state: null, lastEvent: null,
            }])
            setActiveSessionId(id)
            window.electronAPI.spawnSession(id, { cwd: testCwds[i], initialPrompt: prompt })
          }, i * 2000)
        }
      } else {
        // No auto-spawn — show the new agent modal
        setShowNewAgent(true)
      }
    })
  }, [])

  // Cmd+N to open new agent modal
  useEffect(() => {
    const handler = (e) => {
      if (e.metaKey && e.key === 'n') {
        e.preventDefault()
        setShowNewAgent(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Global IPC listeners
  useEffect(() => {
    const removeStarted = window.electronAPI.onJsonlSessionStarted((id) => {
      setSessions(prev => prev.map(s => s.id === id ? { ...s, claudeActive: true } : s))
    })
    const removeEnded = window.electronAPI.onJsonlSessionEnded((id) => {
      setSessions(prev => prev.map(s => s.id === id ? { ...s, claudeActive: false, state: null } : s))
    })
    const removeState = window.electronAPI.onJsonlState((id, state) => {
      setSessions(prev => prev.map(s => s.id === id ? { ...s, state } : s))
    })
    const removeEvent = window.electronAPI.onJsonlEvent((id, entry) => {
      setSessions(prev => prev.map(s => s.id === id ? { ...s, lastEvent: entry.label } : s))
    })
    return () => {
      removeStarted()
      removeEnded()
      removeState()
      removeEvent()
    }
  }, [])

  const handleNewAgent = async () => {
    const branch = branchInput.trim()
    if (!branch) return
    if (!/^[\w][\w./-]*$/.test(branch)) {
      alert('Invalid branch name. Use letters, numbers, hyphens, dots, or slashes.')
      return
    }

    setShowNewAgent(false)
    setBranchInput('')

    try {
      const { worktreePath } = await window.electronAPI.worktreeCreate(branch)
      await spawnAgent(branch, worktreePath)
    } catch (err) {
      console.error('Failed to create agent:', err)
      alert(`Failed to create agent: ${err.message}`)
    }
  }

  const handleSelectAgent = (sessionId) => {
    setActiveSessionId(sessionId)
    setView('agent')
  }

  const [closeModal, setCloseModal] = useState(null) // { sessionId, session, dirty }

  const handleCloseSession = async (sessionId) => {
    const session = sessions.find(s => s.id === sessionId)
    if (!session) return

    if (session.branch) {
      let dirty = false
      try {
        const result = await window.electronAPI.worktreeIsDirty(session.branch)
        dirty = result.dirty
      } catch {}
      setCloseModal({ sessionId, session, dirty })
    } else {
      if (!confirm('Close this session?')) return
      await doEndSession(sessionId)
    }
  }

  const doEndSession = async (sessionId) => {
    try {
      await window.electronAPI.killSession(sessionId)
    } catch (err) {
      console.error('Failed to kill session:', err)
    }
    setSessions(prev => {
      const remaining = prev.filter(s => s.id !== sessionId)
      if (activeSessionId === sessionId) {
        setActiveSessionId(remaining.length > 0 ? remaining[0].id : null)
      }
      return remaining
    })
  }

  const doEndSessionAndRemoveWorktree = async (sessionId, branch, dirty) => {
    if (dirty) {
      if (!confirm(`Branch "${branch}" has uncommitted changes.\n\nRemove worktree anyway?`)) return
    }
    try {
      await window.electronAPI.killSession(sessionId)
      // Small delay to let PTY process release the directory
      await new Promise(r => setTimeout(r, 500))
      await window.electronAPI.worktreeRemove(branch, dirty)
    } catch (err) {
      console.error('Failed to remove worktree:', err)
    }
    setSessions(prev => {
      const remaining = prev.filter(s => s.id !== sessionId)
      if (activeSessionId === sessionId) {
        setActiveSessionId(remaining.length > 0 ? remaining[0].id : null)
      }
      return remaining
    })
  }

  const sidebar = (
    <div className="flex flex-col h-full min-h-0">
      <SessionList
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={setActiveSessionId}
        onClose={handleCloseSession}
      />
      <div className="flex-1 min-h-0 relative">
        {sessions.map(session => (
          <div
            key={session.id}
            className={`absolute inset-0 ${session.id === activeSessionId ? 'flex flex-col' : 'hidden'}`}
          >
            <StateLog sessionId={session.claudeActive ? session.id : null} />
          </div>
        ))}
        {sessions.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-text-muted">Create an agent to get started</p>
          </div>
        )}
      </div>
    </div>
  )

  const terminals = (
    <div className="relative h-full">
      {sessions.map(session => (
        <div
          key={session.id}
          className={`absolute inset-0 ${session.id === activeSessionId ? 'block' : 'hidden'}`}
        >
          <TerminalPanel sessionId={session.id} active={session.id === activeSessionId} />
        </div>
      ))}
    </div>
  )

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface-0">
      <div
        className="flex items-center justify-between border-b border-border px-4 py-2 shrink-0"
        style={{ WebkitAppRegion: 'drag' }}
      >
        <div className="flex items-center gap-3 pl-16">
          <span className="text-xs font-medium text-text-secondary">Agent Manager</span>
          <div className="flex border border-border rounded overflow-hidden" style={{ WebkitAppRegion: 'no-drag' }}>
            <button
              onClick={() => setView('agent')}
              className={`text-[11px] px-2.5 py-1 transition-colors ${view === 'agent' ? 'bg-surface-2 text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}
            >
              Agent
            </button>
            <button
              onClick={() => setView('board')}
              className={`text-[11px] px-2.5 py-1 transition-colors ${view === 'board' ? 'bg-surface-2 text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}
            >
              Board
            </button>
          </div>
        </div>
        <div style={{ WebkitAppRegion: 'no-drag' }}>
          <button
            onClick={() => setShowNewAgent(true)}
            className="text-xs text-text-muted hover:text-text-primary border border-border hover:border-border-bright rounded px-2 py-1 transition-colors"
          >
            + New Agent
          </button>
        </div>
      </div>

      <div className={`flex-1 min-h-0 ${view === 'agent' ? 'flex' : 'hidden'}`}>
        <ResizableSplit
          left={sidebar}
          right={terminals}
          defaultRatio={0.3}
          minLeftPx={250}
          minRightPx={400}
        />
      </div>
      <div className={`flex-1 min-h-0 ${view === 'board' ? 'flex' : 'hidden'}`}>
        <KanbanBoard
          sessions={sessions}
          onSelectAgent={handleSelectAgent}
          onClose={handleCloseSession}
          onNewAgent={() => setShowNewAgent(true)}
        />
      </div>

      {closeModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setCloseModal(null)}
        >
          <div
            className="bg-surface-1 border border-border rounded-lg p-6 w-96 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-semibold text-text-primary mb-2">
              Close "{closeModal.session.branch}"
            </h2>
            {closeModal.dirty && (
              <p className="text-xs text-status-guidance mb-4">
                This branch has uncommitted changes.
              </p>
            )}
            <div className="flex flex-col gap-2 mt-4">
              <button
                onClick={() => {
                  const { sessionId } = closeModal
                  setCloseModal(null)
                  doEndSession(sessionId)
                }}
                className="w-full text-xs text-left bg-surface-0 hover:bg-surface-2 text-text-primary border border-border rounded px-3 py-2.5 transition-colors"
              >
                <span className="font-medium">End session</span>
                <span className="text-text-muted block mt-0.5">Kill Claude and close the terminal. Worktree stays on disk.</span>
              </button>
              <button
                onClick={() => {
                  const { sessionId, session, dirty } = closeModal
                  setCloseModal(null)
                  doEndSessionAndRemoveWorktree(sessionId, session.branch, dirty)
                }}
                className="w-full text-xs text-left bg-surface-0 hover:bg-surface-2 text-text-primary border border-border rounded px-3 py-2.5 transition-colors"
              >
                <span className="font-medium">End session + remove worktree</span>
                <span className="text-text-muted block mt-0.5">Kill Claude, close the terminal, and delete the worktree directory.</span>
              </button>
              <button
                onClick={() => setCloseModal(null)}
                className="w-full text-xs text-text-muted hover:text-text-primary px-3 py-1.5 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewAgent && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setShowNewAgent(false)}
        >
          <div
            className="bg-surface-1 border border-border rounded-lg p-6 w-80 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-semibold text-text-primary mb-4">New Agent</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleNewAgent() }}>
              <label className="text-xs text-text-secondary block mb-1.5">Branch name</label>
              <input
                autoFocus
                value={branchInput}
                onChange={(e) => setBranchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setShowNewAgent(false)}
                placeholder="feat-my-feature"
                className="w-full text-xs font-mono bg-surface-0 text-text-primary border border-border rounded px-3 py-2 outline-none focus:border-status-running"
              />
              <div className="flex justify-end gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => setShowNewAgent(false)}
                  className="text-xs text-text-muted hover:text-text-primary px-3 py-1.5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!branchInput.trim()}
                  className="text-xs bg-status-running text-white rounded px-3 py-1.5 hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
