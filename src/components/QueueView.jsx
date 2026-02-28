import TaskCard from './TaskCard'

export default function QueueView({ tasks, onSelectTask, selectedTaskId }) {
  const queueTasks = tasks
    .filter((t) => t.status === 'input-required')
    .sort((a, b) => a.createdAt - b.createdAt)

  if (queueTasks.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="text-center">
          <p className="text-lg font-medium text-text-secondary">All clear</p>
          <p className="mt-1 text-sm text-text-muted">No agents waiting for input.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto flex-1 min-h-0">
      <div className="mx-auto w-full max-w-2xl space-y-3 px-6 pb-6 pt-4">
        {queueTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onSelectTask={onSelectTask}
            isSelected={task.id === selectedTaskId}
          />
        ))}
      </div>
    </div>
  )
}
