export default function TopBar({ view, onViewChange, queueCount, onNewTask }) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-surface-1/80 backdrop-blur-md px-6 py-3 sticky top-0 z-40">
      <div className="flex items-center gap-6">
        <h1 className="text-base font-bold tracking-tight text-text-primary">Orchestrator</h1>

        <div className="flex rounded-lg bg-surface-0 p-0.5 border border-border">
          <button
            onClick={() => onViewChange('board')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              view === 'board'
                ? 'bg-surface-3 text-text-primary'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Board
          </button>
          <button
            onClick={() => onViewChange('queue')}
            className={`relative rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              view === 'queue'
                ? 'bg-surface-3 text-text-primary'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Queue
            {queueCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-status-guidance/20 px-1.5 py-0.5 text-[10px] font-bold text-status-guidance min-w-[18px]">
                {queueCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="font-mono text-xs text-text-muted">acme/webapp</span>
        <button
          onClick={onNewTask}
          className="rounded-lg bg-white/10 px-3.5 py-1.5 text-xs font-medium text-text-primary hover:bg-white/15 transition-colors cursor-pointer"
        >
          + New Task
        </button>
      </div>
    </header>
  )
}
