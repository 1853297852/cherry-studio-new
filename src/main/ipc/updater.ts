import { ipcMain } from 'electron'
import { updaterService } from '../services/UpdaterService'

export function registerUpdaterIpc() {
  // Check for updates manually
  ipcMain.handle('updater:check', async () => {
    return updaterService.checkForUpdates()
  })

  // Get update status
  ipcMain.handle('updater:status', () => {
    return updaterService.getUpdateStatus()
  })

  // Install update and quit app
  ipcMain.handle('updater:install', () => {
    updaterService.quitAndInstall()
  })
}
