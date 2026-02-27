import TaskCard from './TaskCard'

const columns = [
  { status: 'backlog', label: 'Backlog', color: 'bg-status-backlog' },
  { status: 'running', label: 'Running', color: 'bg-status-running' },
  { status: 'needs-guidance', label: 'Needs Guidance', color: 'bg-status-guidance' },
  { status: 'review', label: 'Review', color: 'bg-status-review' },
  { status: 'merged', label: 'Merged', color: 'bg-status-merged' },
  { status: 'failed', label: 'Failed', color: 'bg-status-failed' },
]

export default function BoardView({ tasks, onUpdateStatus }) {
  return (
    <div className="flex gap-4 overflow-x-auto px-6 pb-6 min-h-0 flex-1">
      {columns.map((col) => {
        const colTasks = tasks
          .filter((t) => t.status === col.status)
          .sort((a, b) => b.updatedAt - a.updatedAt)

        return (
          <div key={col.status} className="flex flex-col min-w-[280px] w-[280px] shrink-0">
            <div className="flex items-center gap-2 px-1 py-3 sticky top-0">
              <span className={`h-2 w-2 rounded-full ${col.color}`} />
              <h2 className="text-sm font-semibold text-text-secondary">{col.label}</h2>
              <span className="ml-auto rounded-full bg-surface-3 px-2 py-0.5 text-xs font-mono text-text-muted">
                {colTasks.length}
              </span>
            </div>
            <div className="flex flex-col gap-3 overflow-y-auto flex-1 pr-1">
              {colTasks.map((task) => (
                <TaskCard key={task.id} task={task} onUpdateStatus={onUpdateStatus} />
              ))}
              {colTasks.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-6 text-center">
                  <p className="text-xs text-text-muted">No tasks</p>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
