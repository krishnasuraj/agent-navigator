import { useTerminal } from '../hooks/useTerminal'

const statusDot = {
  idle: 'bg-status-backlog',
  'in-progress': 'bg-status-running animate-glow',
  'input-required': 'bg-status-guidance animate-glow',
  completed: 'bg-status-merged',
}

export default function TerminalPanel({ task, onClose }) {
  const terminalRef = useTerminal(task?.id)

  if (!task) return null

  const dot = statusDot[task.status] || 'bg-status-backlog'

  return (
    <div className="relative h-full bg-surface-0 border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`h-2 w-2 rounded-full shrink-0 ${dot}`} />
          <span className="text-sm font-medium text-text-primary truncate">{task.title}</span>
          <span className="font-mono text-xs text-text-muted shrink-0">{task.branch}</span>
        </div>
        <button
          onClick={onClose}
          className="ml-3 shrink-0 rounded-md p-1.5 text-text-muted hover:text-text-secondary hover:bg-surface-2 transition-colors cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>
      </div>

      {/* Terminal — absolute positioned below header to guarantee pixel dimensions */}
      <div
        ref={terminalRef}
        className="absolute left-0 right-0 bottom-0 p-2 overflow-hidden"
        style={{ top: '41px' }}
      />
    </div>
  )
}
