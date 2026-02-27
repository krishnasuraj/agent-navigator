import { useState } from 'react'

const agentOptions = [
  { id: 'claude-code', label: 'Claude Code', icon: '◈', color: 'border-orange-400 bg-orange-400/10 text-orange-400' },
  { id: 'codex', label: 'Codex', icon: '◉', color: 'border-emerald-400 bg-emerald-400/10 text-emerald-400' },
  { id: 'cursor', label: 'Cursor', icon: '▸', color: 'border-blue-400 bg-blue-400/10 text-blue-400' },
]

const baseBranches = ['main', 'develop', 'feature/auth', 'feature/payments']

export default function TaskModal({ onClose, onCreateTask }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [agent, setAgent] = useState('claude-code')
  const [baseBranch, setBaseBranch] = useState('main')

  function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    onCreateTask({ title: title.trim(), description: description.trim(), agent, baseBranch })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-surface-1 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-text-primary">New Task</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-secondary transition-colors cursor-pointer">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What should the agent do?"
              className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-border-bright transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide context and details for the agent..."
              rows={3}
              className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-border-bright transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Agent</label>
            <div className="grid grid-cols-3 gap-2">
              {agentOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setAgent(opt.id)}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-xs font-medium transition-all cursor-pointer ${
                    agent === opt.id
                      ? opt.color
                      : 'border-border bg-surface-2 text-text-secondary hover:border-border-bright'
                  }`}
                >
                  <span className="font-mono text-lg">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Base Branch</label>
            <select
              value={baseBranch}
              onChange={(e) => setBaseBranch(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm text-text-primary outline-none focus:border-border-bright transition-colors cursor-pointer"
            >
              {baseBranches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-text-primary hover:bg-white/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
