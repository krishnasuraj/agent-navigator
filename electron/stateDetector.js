// Heuristic state detector for Claude Code interactive terminal sessions.
// Strips ANSI codes from raw PTY output and pattern-matches to classify
// task state: idle, in-progress, input-required, completed.

const ANSI_REGEX = /\x1b\[[0-9;]*[A-Za-z]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[^[\]]/g

function stripAnsi(str) {
  return str.replace(ANSI_REGEX, '')
}

// Claude Code interactive output patterns (after ANSI stripping)
const PATTERNS = {
  // Tool execution — Claude is actively working
  toolExec: /[●✓✗⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]\s+(?:Read|Write|Edit|Bash|Glob|Grep|WebFetch|Agent|Skill)/,

  // Claude startup banner (box-drawing characters)
  claudeStartup: /╭[─━]/,

  // Permission prompt — Claude wants tool approval
  permissionPrompt: /Allow|Approve|Deny|approve this|allow this/i,

  // Claude idle prompt — waiting for next user message
  // The ❯ character (U+276F) or > at start of line
  claudePrompt: /^\s*[❯>]\s*$/m,

  // Claude result / completion
  claudeResult: /(?:Task complete|Done[.!]?\s*$|Completed|finished)/mi,

  // Shell prompt indicators (conservative — end of buffer)
  shellPrompt: /[$%#]\s*$/,
}

const MAX_BUFFER_LINES = 50
const IDLE_DEBOUNCE_MS = 4000

export function createStateDetector(taskStore) {
  const buffers = new Map()      // taskId -> string[]
  const states = new Map()       // taskId -> current status
  const idleTimers = new Map()   // taskId -> timeout

  function feed(taskId, rawData) {
    const plain = stripAnsi(rawData)

    // Update rolling buffer
    const lines = buffers.get(taskId) || []
    const newLines = plain.split('\n')
    const updated = [...lines, ...newLines].slice(-MAX_BUFFER_LINES)
    buffers.set(taskId, updated)

    // Cancel pending idle timer on any new output
    const timer = idleTimers.get(taskId)
    if (timer) {
      clearTimeout(timer)
      idleTimers.delete(taskId)
    }

    // Classify based on recent output (last ~10 lines for responsiveness)
    const recentText = updated.slice(-10).join('\n')
    const detected = classify(recentText)

    if (detected && detected !== states.get(taskId)) {
      if (detected === 'idle') {
        // Debounce idle transitions to avoid flickering
        idleTimers.set(
          taskId,
          setTimeout(() => {
            applyState(taskId, 'idle')
            idleTimers.delete(taskId)
          }, IDLE_DEBOUNCE_MS),
        )
      } else {
        applyState(taskId, detected)
      }
    }
  }

  function classify(text) {
    // Priority order matters — check most specific first

    // Permission check = input required (highest priority)
    if (PATTERNS.permissionPrompt.test(text)) return 'input-required'

    // Claude idle prompt (❯) = waiting for next instruction
    if (PATTERNS.claudePrompt.test(text)) return 'input-required'

    // Active tool execution = in progress
    if (PATTERNS.toolExec.test(text)) return 'in-progress'

    // Startup banner = just launched, in progress
    if (PATTERNS.claudeStartup.test(text)) return 'in-progress'

    // Result/completion text
    if (PATTERNS.claudeResult.test(text)) return 'completed'

    // Shell prompt with no claude activity = idle
    if (PATTERNS.shellPrompt.test(text)) return 'idle'

    // Unknown — don't change state
    return null
  }

  function applyState(taskId, status) {
    if (states.get(taskId) === status) return
    states.set(taskId, status)
    const task = taskStore.get(taskId)
    if (task) {
      taskStore.update(taskId, { status })
    }
  }

  function reset(taskId) {
    buffers.delete(taskId)
    states.delete(taskId)
    const timer = idleTimers.get(taskId)
    if (timer) clearTimeout(timer)
    idleTimers.delete(taskId)
  }

  return { feed, reset }
}
