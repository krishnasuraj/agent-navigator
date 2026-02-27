const statusConfig = {
  backlog: { label: 'Backlog', color: 'bg-status-backlog/20 text-status-backlog' },
  running: { label: 'Running', color: 'bg-status-running/20 text-status-running' },
  'needs-guidance': { label: 'Needs Guidance', color: 'bg-status-guidance/20 text-status-guidance' },
  review: { label: 'Review', color: 'bg-status-review/20 text-status-review' },
  merged: { label: 'Merged', color: 'bg-status-merged/20 text-status-merged' },
  failed: { label: 'Failed', color: 'bg-status-failed/20 text-status-failed' },
}

export default function StatusBadge({ status }) {
  const config = statusConfig[status]
  if (!config) return null

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.color}`}
    >
      {status === 'running' && (
        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-status-running animate-glow" />
      )}
      {config.label}
    </span>
  )
}
