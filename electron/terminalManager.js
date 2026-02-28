// Terminal lifecycle manager. Spawns the user's shell in a task's worktree
// and pipes PTY output bidirectionally to the renderer via IPC.

import pty from 'node-pty'
import fs from 'fs'
import os from 'os'
import { execSync } from 'child_process'
import { createWorktree } from './worktree.js'

function getUserShell() {
  // Try env first
  if (process.env.SHELL && fs.existsSync(process.env.SHELL)) {
    return process.env.SHELL
  }
  // Try dscl with os.userInfo (doesn't depend on $USER env var)
  try {
    const username = os.userInfo().username
    const output = execSync(`dscl . -read /Users/${username} UserShell`, { encoding: 'utf8' })
    const shell = output.split(':').pop().trim()
    if (fs.existsSync(shell)) return shell
  } catch {
    // ignore
  }
  // Hardcoded fallbacks — check which exists
  for (const s of ['/bin/zsh', '/bin/bash', '/bin/sh']) {
    if (fs.existsSync(s)) return s
  }
  return '/bin/sh'
}

export function createTerminalManager(taskStore, stateDetector, getWindow) {
  const sessions = new Map() // taskId -> { ptyProcess, worktreePath }

  function startTerminal(taskId) {
    const task = taskStore.get(taskId)
    if (!task) throw new Error(`Task ${taskId} not found`)
    if (sessions.has(taskId)) return // already running

    let worktreePath
    try {
      worktreePath = createWorktree(task)
    } catch (err) {
      console.error('[terminalManager] worktree creation failed:', err.message)
      worktreePath = process.cwd()
    }
    taskStore.update(taskId, { worktreePath, status: 'idle' })

    const shell = getUserShell()
    const cwdExists = fs.existsSync(worktreePath)

    let ptyProcess
    try {
      ptyProcess = pty.spawn(shell, ['-l'], {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd: cwdExists ? worktreePath : process.cwd(),
        env: { ...process.env },
      })
    } catch (err) {
      console.error('[terminalManager] pty.spawn failed:', err.message)
      return
    }

    sessions.set(taskId, { ptyProcess, worktreePath })

    ptyProcess.onData((data) => {
      const win = getWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send(`terminal:data:${taskId}`, data)
      }
      stateDetector.feed(taskId, data)
    })

    ptyProcess.onExit(() => {
      sessions.delete(taskId)
      stateDetector.reset(taskId)
      taskStore.update(taskId, { status: 'idle' })
    })
  }

  function stopTerminal(taskId) {
    const session = sessions.get(taskId)
    if (!session) return false
    session.ptyProcess.kill()
    sessions.delete(taskId)
    stateDetector.reset(taskId)
    taskStore.update(taskId, { status: 'idle' })
    return true
  }

  function writeToTerminal(taskId, data) {
    const session = sessions.get(taskId)
    if (session) session.ptyProcess.write(data)
  }

  function resizeTerminal(taskId, cols, rows) {
    const session = sessions.get(taskId)
    if (session) session.ptyProcess.resize(cols, rows)
  }

  function isRunning(taskId) {
    return sessions.has(taskId)
  }

  return { startTerminal, stopTerminal, writeToTerminal, resizeTerminal, isRunning }
}
