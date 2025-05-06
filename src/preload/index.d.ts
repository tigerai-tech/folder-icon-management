import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      applyIconToFolder: (folderPath: string, iconPath: string) => Promise<void>
      getDraggedFolderPath: (event: DragEvent) => string | null
      checkPath: (path: string) => Promise<{exists: boolean, isDirectory: boolean, path: string}>
      selectFolder: () => Promise<string | null>
      getFilePath: (file: File) => string | null
      selectIconFile: () => Promise<string | null>
      getBase64FromFilePath: (filePath: string) => Promise<string>
      copyIconToDownloads: (iconPath: string) => Promise<{
        success: boolean,
        filePath?: string,
        fileName?: string,
        error?: string
      }>
      getInternalIconPath: (iconPath: string) => Promise<{
        success: boolean,
        iconPath?: string,
        error?: string
      }>
    }
  }
}
