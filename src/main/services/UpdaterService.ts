import { app } from 'electron'
import { autoUpdater, AppUpdater } from 'electron-updater'
import { loggerService } from '@logger'
import { IpcMainEvent, ipcMain } from 'electron'

const logger = loggerService.withContext('UpdaterService')

interface UpdateInfo {
  version: string
  available: boolean
  downloaded: boolean
  error?: string
}

class UpdaterService {
  private updater: AppUpdater
  private isUpdateDownloaded = false

  constructor() {
    this.updater = autoUpdater

    // Configure auto updater
    this.setupAutoUpdater()
  }

  private setupAutoUpdater() {
    // Set up logging
    autoUpdater.logger = logger

    // Configure feed URL for updates
    // Supports: GitHub, Generic, S3 providers
    // Default: GitHub releases
    autoUpdater.checkForUpdatesAndNotify()

    // Listen to updater events
    this.setupEventListeners()
  }

  private setupEventListeners() {
    // Check for update available
    autoUpdater.on('update-available', (info) => {
      logger.info('Update available:', {
        version: info.version,
        releaseDate: info.releaseDate
      })
    })

    // No update available
    autoUpdater.on('update-not-available', (info) => {
      logger.info('Update not available', {
        version: info.version
      })
    })

    // Update download started
    autoUpdater.on('download-progress', (progressInfo) => {
      logger.info('Update download progress:', {
        percent: progressInfo.percent,
        transferred: progressInfo.transferred,
        total: progressInfo.total
      })
    })

    // Update downloaded successfully
    autoUpdater.on('update-downloaded', (info) => {
      logger.info('Update downloaded successfully:', {
        version: info.version
      })
      this.isUpdateDownloaded = true

      // Notify renderer process
      const mainWindow = require('./WindowService').windowService.getMainWindow()
      if (mainWindow) {
        mainWindow.webContents.send('update-downloaded', {
          version: info.version,
          releaseNotes: info.releaseNotes
        })
      }

      // Automatically install update after 5 minutes of inactivity
      this.scheduleUpdateInstall()
    })

    // Update error
    autoUpdater.on('error', (error) => {
      logger.error('Update error:', {
        message: error.message,
        stack: error.stack
      })
    })
  }

  /**
   * Check for updates manually
   */
  public async checkForUpdates(): Promise<UpdateInfo> {
    try {
      const result = await autoUpdater.checkForUpdates()

      if (result?.updateInfo) {
        return {
          version: result.updateInfo.version,
          available: !!result.downloadPromise,
          downloaded: false
        }
      }

      return {
        version: app.getVersion(),
        available: false,
        downloaded: false
      }
    } catch (error) {
      logger.error('Failed to check for updates:', error)
      return {
        version: app.getVersion(),
        available: false,
        downloaded: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Schedule update installation after inactivity
   */
  private scheduleUpdateInstall() {
    // Install update after 5 minutes
    setTimeout(() => {
      if (this.isUpdateDownloaded) {
        logger.info('Installing update...')
        autoUpdater.quitAndInstall()
      }
    }, 5 * 60 * 1000)
  }

  /**
   * Quit and install update immediately
   */
  public quitAndInstall() {
    if (this.isUpdateDownloaded) {
      autoUpdater.quitAndInstall()
    } else {
      logger.warn('No update downloaded yet')
    }
  }

  /**
   * Get current update status
   */
  public getUpdateStatus() {
    return {
      version: app.getVersion(),
      isUpdateDownloaded: this.isUpdateDownloaded
    }
  }

  /**
   * Initialize IPC handlers for updater
   */
  public initIpcHandlers() {
    // Check for updates
    ipcMain.handle('check-for-updates', async () => {
      return this.checkForUpdates()
    })

    // Get update status
    ipcMain.handle('get-update-status', () => {
      return this.getUpdateStatus()
    })

    // Quit and install
    ipcMain.handle('install-update', () => {
      this.quitAndInstall()
      return true
    })
  }
}

export const updaterService = new UpdaterService()
