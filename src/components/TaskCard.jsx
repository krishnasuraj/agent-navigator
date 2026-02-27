import { useState } from 'react'
import StatusBadge from './StatusBadge'
import AgentIcon from './AgentIcon'

function timeAgo(ts) {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const actionButtons = {
  backlog: [{ label: 'Start', next: 'running', style: 'bg-status-running/20 text-status-running hover:bg-status-running/30' }],
  running: [{ label: 'Stop', next: 'backlog', style: 'bg-status-failed/20 text-status-failed hover:bg-status-failed/30' }],
  'needs-guidance': [
    { label: 'Approve', next: 'running', style: 'bg-status-merged/20 text-status-merged hover:bg-status-merged/30' },
    { label: 'Dismiss', next: 'backlog', style: 'bg-surface-3 text-text-secondary hover:bg-border' },
  ],
  review: [
    { label: 'Approve & Merge', next: 'merged', style: 'bg-status-merged/20 text-status-merged hover:bg-status-merged/30' },
    { label: 'Request Changes', next: 'running', style: 'bg-status-guidance/20 text-status-guidance hover:bg-status-guidance/30' },
  ],
  failed: [
    { label: 'Retry', next: 'running', style: 'bg-status-running/20 text-status-running hover:bg-status-running/30' },
    { label: 'Dismiss', next: 'backlog', style: 'bg-surface-3 text-text-secondary hover:bg-border' },
  ],
  merged: [],
}

export default function TaskCard({ task, onUpdateStatus, variant = 'board' }) {
  const [expanded, setExpanded] = useState(false)
  const actions = actionButtons[task.status] || []
  const isRunning = task.status === 'running'
  const isQueue = variant === 'queue'

  return (
    <div
      className={`relative rounded-lg border p-4 transition-all duration-200 ${
        isRunning
          ? 'border-status-running/40 bg-surface-2 shadow-[0_0_12px_rgba(59,130,246,0.08)]'
          : 'border-border bg-surface-2 hover:border-border-bright'
      }`}
      onClick={isQueue ? () => setExpanded(!expanded) : undefined}
      role={isQueue ? 'button' : undefined}
    >
      {isRunning && (
        <div className="absolute inset-0 rounded-lg border border-status-running/30 animate-glow pointer-events-none" />
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-text-primary truncate">{task.title}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <AgentIcon agent={task.agent} />
            <span className="font-mono text-xs text-text-muted">{task.branch}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {isQueue && <StatusBadge status={task.status} />}
          <span className="font-mono text-[11px] text-text-muted">{timeAgo(task.updatedAt)}</span>
        </div>
      </div>

      {isQueue && expanded && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <p className="text-xs text-text-secondary leading-relaxed">{task.description}</p>
          {task.guidanceReason && (
            <div className="rounded-md bg-status-guidance/10 p-2.5">
              <p className="text-xs text-status-guidance">{task.guidanceReason}</p>
            </div>
          )}
          {task.summary && (
            <div className="rounded-md bg-surface-3 p-2.5">
              <p className="text-xs text-text-secondary">{task.summary}</p>
            </div>
          )}
          {task.error && (
            <div className="rounded-md bg-status-failed/10 p-2.5">
              <p className="font-mono text-xs text-status-failed">{task.error}</p>
            </div>
          )}
        </div>
      )}

      {actions.length > 0 && (
        <div className="mt-3 flex gap-2">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={(e) => {
                e.stopPropagation()
                onUpdateStatus(task.id, action.next)
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${action.style}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
