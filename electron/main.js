import { app, BrowserWindow } from 'electron'
import path from 'path'
import { createTaskStore } from './taskStore.js'
import { createStateDetector } from './stateDetector.js'
import { createTerminalManager } from './terminalManager.js'
import { registerIpcHandlers } from './ipc.js'

let mainWindow = null

const taskStore = createTaskStore()
const stateDetector = createStateDetector(taskStore)

function getWindow() {
  return mainWindow
}

const terminalManager = createTerminalManager(taskStore, stateDetector, getWindow)

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  })

  registerIpcHandlers(taskStore, terminalManager, getWindow)

  taskStore.onChange((task) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('task:updated', task)
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
