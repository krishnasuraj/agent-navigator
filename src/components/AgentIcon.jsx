const agents = {
  'claude-code': { label: 'Claude Code', icon: '◈', color: 'text-orange-400' },
  codex: { label: 'Codex', icon: '◉', color: 'text-emerald-400' },
  cursor: { label: 'Cursor', icon: '▸', color: 'text-blue-400' },
}

export default function AgentIcon({ agent, showLabel = true }) {
  const config = agents[agent]
  if (!config) return null

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${config.color}`}>
      <span className="font-mono text-sm">{config.icon}</span>
      {showLabel && config.label}
    </span>
  )
}
