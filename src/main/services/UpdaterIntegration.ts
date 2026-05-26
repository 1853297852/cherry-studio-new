import { app } from 'electron'
import { loggerService } from '@logger'
import { updaterService } from './services/UpdaterService'
import { registerUpdaterIpc } from './ipc/updater'

const logger = loggerService.withContext('UpdaterIntegration')

/**
 * Initialize auto-updater on app ready
 * 
 * This should be called in src/main/index.ts after window creation
 * 
 * @example
 * ```typescript
 * import { initializeUpdater } from './services/UpdaterIntegration'
 * 
 * app.whenReady().then(async () => {
 *   await initializeUpdater()
 * })
 * ```
 */
export async function initializeUpdater() {
  try {
    logger.info('Initializing auto-updater...')

    // Register IPC handlers for updater
    registerUpdaterIpc()

    // Check for updates on startup (in production)
    if (!process.env.NODE_ENV || process.env.NODE_ENV === 'production') {
      logger.info('Checking for updates on startup')
      const updateInfo = await updaterService.checkForUpdates()

      if (updateInfo.available) {
        logger.info(`Update available: ${updateInfo.version}`)
      } else {
        logger.info('No update available, app is up to date')
      }
    } else {
      logger.info('Development mode: skipping auto-update check')
    }

    logger.info('✅ Auto-updater initialized successfully')
  } catch (error) {
    logger.error('Failed to initialize auto-updater:', error)
    // Don't throw - updater failure shouldn't prevent app from running
  }
}

/**
 * Cleanup updater on app quit
 */
export function cleanupUpdater() {
  logger.info('Cleaning up updater...')
  // Any cleanup if needed
}
