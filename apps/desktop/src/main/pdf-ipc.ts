import { copyFile } from 'node:fs/promises'
import { BrowserWindow, dialog, shell } from 'electron'
import { idSchema } from '@trackit/shared/schemas'
import { handle } from './data-ipc'
import type { PdfService } from './pdf/service'
import { RepositoryError } from './repositories/errors'

/**
 * The PDF channels. `generate` is the plain service; the other two are the
 * two things only this process can do with a file — show it in the file
 * manager, and offer the system save dialog over it.
 */
export function registerPdfIpc(service: PdfService): void {
  const cachedOrRefuse = (invoiceId: string) => {
    const cached = service.cached(invoiceId)
    if (!cached) throw new RepositoryError('not_found', 'No PDF has been made for this invoice on this machine')
    return cached
  }

  handle('pdf:generate', idSchema, (invoiceId) => service.generate(invoiceId))

  handle('pdf:reveal', idSchema, (invoiceId) => {
    shell.showItemInFolder(cachedOrRefuse(invoiceId).path)
    return null
  })

  handle('pdf:saveAs', idSchema, async (invoiceId) => {
    const cached = cachedOrRefuse(invoiceId)
    const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const options = {
      defaultPath: cached.fileName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    }
    const chosen = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options)
    if (chosen.canceled || !chosen.filePath) return null
    await copyFile(cached.path, chosen.filePath)
    return chosen.filePath
  })
}
