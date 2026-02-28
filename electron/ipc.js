import { ipcMain } from 'electron'

export function registerIpcHandlers(taskStore, terminalManager, getWindow) {
  ipcMain.handle('tasks:getAll', () => {
    return taskStore.getAll()
  })

  ipcMain.handle('tasks:create', (_, { title, baseBranch }) => {
    if (!title) throw new Error('Title is required')
    const task = taskStore.create({ title, baseBranch })

    const win = getWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('task:created', task)
    }

    // Auto-start shell terminal in the worktree (don't let spawn failure block task creation)
    try {
      terminalManager.startTerminal(task.id)
    } catch (err) {
      console.error('[ipc] terminal auto-start failed:', err.message)
    }
    return task
  })

  ipcMain.handle('tasks:delete', (_, taskId) => {
    terminalManager.stopTerminal(taskId)
    const deleted = taskStore.delete(taskId)
    if (deleted) {
      const win = getWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send('task:deleted', taskId)
      }
    }
    return deleted
  })

  ipcMain.handle('terminal:start', (_, taskId) => {
    terminalManager.startTerminal(taskId)
    return true
  })

  // Fire-and-forget: keystrokes from renderer to PTY
  ipcMain.on('terminal:input', (_, taskId, data) => {
    terminalManager.writeToTerminal(taskId, data)
  })

  // Fire-and-forget: terminal resize
  ipcMain.on('terminal:resize', (_, { taskId, cols, rows }) => {
    terminalManager.resizeTerminal(taskId, cols, rows)
  })
}
