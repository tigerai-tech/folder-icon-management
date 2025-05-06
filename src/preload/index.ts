import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // 新增IPC通道
  applyIconToFolder: (folderPath: string, iconPath: string): Promise<void> => {
    return ipcRenderer.invoke('apply-icon', { folderPath, iconPath })
  },
  
  // 增加解析拖拽文件的方法
  getDraggedFolderPath: (event: DragEvent): string | null => {
    console.log('preload: getDraggedFolderPath 被调用')

    if (!event) {
      console.log('preload: 事件对象为空')
      return null
    }
    console.log(event)
    if (!event.dataTransfer) {
      console.log('preload: 事件中无dataTransfer对象')
      return null
    }

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      console.log('preload: 拖拽的文件数量:', event.dataTransfer.files.length)
      console.log(event.dataTransfer)
      const file = event.dataTransfer.files[0]
      console.log('preload: 拖拽的第一个文件类型:', file.type)

      // @ts-ignore - Electron在files上添加的特殊属性
      const path = file.path
      console.log('preload: 解析到的路径:', path)
      return path
    }

    console.log('preload: 未找到有效文件')
    return null
  },
  
  // 获取文件真实路径
  getFilePath: (file: File): string | null => {
    // @ts-ignore - Electron在File上添加的特殊属性
    return file.path || null
  },
  
  // 检查路径是否为文件夹
  checkPath: async (path: string): Promise<{exists: boolean, isDirectory: boolean, path: string}> => {
    console.log('preload: 检查路径:', path)
    return ipcRenderer.invoke('check-path', path)
  },
  
  // 打开选择文件夹对话框
  selectFolder: async (): Promise<string | null> => {
    console.log('preload: 打开选择文件夹对话框')
    return ipcRenderer.invoke('select-folder')
  },
  
  // 打开选择图标文件对话框
  selectIconFile: async (): Promise<string | null> => {
    console.log('preload: 打开选择图标文件对话框')
    return ipcRenderer.invoke('select-icon-file')
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
