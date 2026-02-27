import TaskCard from './TaskCard'

const queueStatuses = ['needs-guidance', 'review', 'failed']

export default function QueueView({ tasks, onUpdateStatus }) {
  const queueTasks = tasks
    .filter((t) => queueStatuses.includes(t.status))
    .sort((a, b) => a.createdAt - b.createdAt)

  if (queueTasks.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="text-center">
          <p className="text-lg font-medium text-text-secondary">All clear</p>
          <p className="mt-1 text-sm text-text-muted">No tasks need your attention right now.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-3 px-6 pb-6 pt-2">
      {queueTasks.map((task) => (
        <TaskCard key={task.id} task={task} onUpdateStatus={onUpdateStatus} variant="queue" />
      ))}
    </div>
  )
}
