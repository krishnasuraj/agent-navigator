import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Tasks
  getTasks: () => ipcRenderer.invoke('tasks:getAll'),
  createTask: (data) => ipcRenderer.invoke('tasks:create', data),
  deleteTask: (taskId) => ipcRenderer.invoke('tasks:delete', taskId),

  onTaskCreated: (cb) => {
    const handler = (_, task) => cb(task)
    ipcRenderer.on('task:created', handler)
    return () => ipcRenderer.removeListener('task:created', handler)
  },
  onTaskUpdated: (cb) => {
    const handler = (_, task) => cb(task)
    ipcRenderer.on('task:updated', handler)
    return () => ipcRenderer.removeListener('task:updated', handler)
  },
  onTaskDeleted: (cb) => {
    const handler = (_, taskId) => cb(taskId)
    ipcRenderer.on('task:deleted', handler)
    return () => ipcRenderer.removeListener('task:deleted', handler)
  },

  // Terminal
  startTerminal: (taskId) => ipcRenderer.invoke('terminal:start', taskId),
  onTerminalData: (taskId, cb) => {
    const channel = `terminal:data:${taskId}`
    const handler = (_, data) => cb(data)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
  sendTerminalInput: (taskId, data) =>
    ipcRenderer.send('terminal:input', taskId, data),
  sendTerminalResize: (taskId, cols, rows) =>
    ipcRenderer.send('terminal:resize', { taskId, cols, rows }),
})
