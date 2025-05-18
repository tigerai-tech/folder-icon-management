import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // 新增IPC通道
  applyIconToFolder: (folderPath: string, iconPath: string): Promise<void> => {
    return ipcRenderer.invoke('apply-icon', { folderPath, iconPath })
  },
  
  // Reset folder icon
  resetFolderIcon: (options: {folderPath: string, deleteFile: boolean}): Promise<any> => {
    console.log('preload: resetFolderIcon 被调用', options)
    return ipcRenderer.invoke('reset-icon', options)
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
  },
  
  // 从文件路径创建Base64图像
  getBase64FromFilePath: async (filePath: string): Promise<string> => {
    console.log('preload: 从文件路径读取Base64图像:', filePath)
    return ipcRenderer.invoke('read-file', filePath)
      .then((response: any) => {
        return response.data
      })
      .catch((error: any) => {
        console.error('读取文件失败:', error)
        // 错误时返回占位图像
        return 'data:image/png;base64,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'
      })
  },
  
  // 复制内置图标到Downloads文件夹
  copyIconToDownloads: async (iconPath: string): Promise<{success: boolean, filePath?: string, fileName?: string, error?: string}> => {
    console.log('preload: 复制图标到Downloads文件夹:', iconPath)
    return ipcRenderer.invoke('copy-icon-to-downloads', iconPath)
  },
  
  // 获取内部图标的真实路径（不复制到Downloads）
  getInternalIconPath: async (iconPath: string): Promise<{success: boolean, iconPath?: string, error?: string}> => {
    console.log('preload: 获取内部图标真实路径:', iconPath)
    return ipcRenderer.invoke('get-internal-icon-path', iconPath)
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
