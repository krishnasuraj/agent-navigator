function timeAgo(ts) {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const dotColor = {
  idle: 'bg-status-backlog',
  'in-progress': 'bg-status-running',
  'input-required': 'bg-status-guidance',
  completed: 'bg-status-merged',
}

export default function TaskCard({ task, onSelectTask, isSelected }) {
  const isInProgress = task.status === 'in-progress'
  const isInputRequired = task.status === 'input-required'
  const dot = dotColor[task.status] || 'bg-status-backlog'

  return (
    <div
      onClick={() => onSelectTask(task.id)}
      role="button"
      className={`relative rounded-lg border p-4 cursor-pointer transition-all duration-200 ${
        isSelected
          ? 'border-border-bright bg-surface-3'
          : isInProgress
            ? 'border-status-running/40 bg-surface-2 shadow-[0_0_12px_rgba(59,130,246,0.08)]'
            : 'border-border bg-surface-2 hover:border-border-bright'
      }`}
    >
      {isInProgress && (
        <div className="absolute inset-0 rounded-lg border border-status-running/30 animate-glow pointer-events-none" />
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-text-primary truncate">{task.title}</h3>
          <span className="font-mono text-xs text-text-muted mt-1.5 block">{task.branch}</span>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`h-2 w-2 rounded-full ${dot} ${isInProgress ? 'animate-glow' : ''}`} />
          <span className="font-mono text-[11px] text-text-muted">{timeAgo(task.updatedAt)}</span>
        </div>
      </div>

      {isInputRequired && (
        <div className="mt-2.5 flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-status-guidance animate-glow" />
          <span className="text-[11px] text-status-guidance font-medium">waiting for input</span>
        </div>
      )}
    </div>
  )
}
