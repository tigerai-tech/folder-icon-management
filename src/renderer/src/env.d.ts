/// <reference types="vite/client" />

interface Window {
  electron: {
    ipcRenderer: {
      send: (channel: string, ...args: any[]) => void
      on: (channel: string, func: (...args: any[]) => void) => void
      once: (channel: string, func: (...args: any[]) => void) => void
      invoke: (channel: string, data: any) => Promise<any>
    }
  }
  api: {
    applyIconToFolder: (folderPath: string, iconPath: string) => Promise<void>
    getDraggedFolderPath: (event: DragEvent) => string | null
    checkPath: (path: string) => Promise<{exists: boolean, isDirectory: boolean, path: string}>
    selectFolder: () => Promise<string | null>
  }
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<{}, {}, any>
  export default component
}
