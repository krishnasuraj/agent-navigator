import { useState } from 'react'
import TopBar from './components/TopBar'
import BoardView from './components/BoardView'
import QueueView from './components/QueueView'
import TaskModal from './components/TaskModal'
import { useTasks } from './hooks/useTasks'

export default function App() {
  const { tasks, addTask, updateStatus, queueCount } = useTasks()
  const [view, setView] = useState('board')
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar
        view={view}
        onViewChange={setView}
        queueCount={queueCount}
        onNewTask={() => setModalOpen(true)}
      />

      <main className="flex-1 overflow-auto pt-4">
        {view === 'board' ? (
          <BoardView tasks={tasks} onUpdateStatus={updateStatus} />
        ) : (
          <QueueView tasks={tasks} onUpdateStatus={updateStatus} />
        )}
      </main>

      {modalOpen && (
        <TaskModal onClose={() => setModalOpen(false)} onCreateTask={addTask} />
      )}
    </div>
  )
}
