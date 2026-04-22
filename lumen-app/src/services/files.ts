/**
 * [INPUT]: 依赖 @tauri-apps/api/core 的 invoke，@tauri-apps/plugin-fs 的 readFile
 * [OUTPUT]: 对外提供 importPdf, loadPdfData
 * [POS]: services 层的文件操作，被 LibraryPage 和 ReaderPage 消费
 */
import { invoke } from '@tauri-apps/api/core'
import { readFile } from '@tauri-apps/plugin-fs'

export async function importPdf(sourcePath: string): Promise<string> {
  return invoke('import_pdf', { sourcePath })
}

export async function loadPdfData(filePath: string): Promise<Uint8Array> {
  return readFile(filePath)
}
