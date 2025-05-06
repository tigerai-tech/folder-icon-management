import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { promises as fs } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import icon from '../../resources/icon.png?asset'

// 使用promisify转换execFile为Promise版本
const execFileAsync = promisify(execFile)

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: true,
      contextIsolation: true,
      webSecurity: true, // 开启网页安全
      allowRunningInsecureContent: false // 不允许运行不安全的内容
    }
  })

  // 设置CSP
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: file:;"
        ]
      }
    });
  });

  // 打开调试工具以查看console.log输出
  mainWindow.webContents.openDevTools()

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    console.log('主窗口已显示')
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  
  // 注册IPC处理程序
  setupIpcHandlers(mainWindow)
}

// 设置IPC处理程序
function setupIpcHandlers(mainWindow: BrowserWindow): void {
  // 处理选择文件夹对话框
  ipcMain.handle('select-folder', async () => {
    console.log('主进程: 打开选择文件夹对话框')
    
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    })
    
    if (!result.canceled && result.filePaths.length > 0) {
      const folderPath = result.filePaths[0]
      console.log('主进程: 用户选择了文件夹:', folderPath)
      return folderPath
    }
    
    console.log('主进程: 用户取消了选择')
    return null
  })

  // 处理拖拽文件
  ipcMain.handle('check-path', async (_, path) => {
    console.log('主进程: 检查路径:', path)
    
    try {
      const stats = await fs.stat(path)
      const isDirectory = stats.isDirectory()
      console.log('主进程: 路径是否为文件夹:', isDirectory)
      return {
        exists: true,
        isDirectory,
        path
      }
    } catch (error) {
      console.log('主进程: 检查路径失败:', error)
      return {
        exists: false,
        isDirectory: false,
        path
      }
    }
  })

  // 处理图标应用
  ipcMain.handle('apply-icon', async (_, args) => {
    try {
      const { folderPath, iconPath } = args
      
      // 检查路径是否有效
      if (!folderPath || !iconPath) {
        throw new Error('无效的文件夹或图标路径')
      }
      
      // 确保目标是文件夹
      try {
        const stats = await fs.stat(folderPath)
        if (!stats.isDirectory()) {
          throw new Error('所选路径不是有效的文件夹')
        }
        
        console.log(`正在处理文件夹: ${folderPath}`)
      } catch (error: any) {
        console.error(`检查文件夹错误: ${error.message}`)
        if (error.code === 'ENOENT') {
          throw new Error(`找不到文件夹: ${folderPath}`)
        }
        throw error
      }
      
      // 如果是URL格式，需要下载到临时文件
      let finalIconPath = iconPath
      if (iconPath.startsWith('data:') || iconPath.startsWith('blob:')) {
        try {
          // 使用用户可访问的临时目录
          const tempDir = app.getPath('temp')
          const randomName = `icon_${Date.now()}.png`
          finalIconPath = join(tempDir, randomName)
          
          // 从Base64提取数据部分
          const base64Data = iconPath.split(',')[1]
          if (base64Data) {
            await fs.writeFile(finalIconPath, Buffer.from(base64Data, 'base64'))
          } else {
            throw new Error('无效的图标数据格式')
          }
        } catch (error: any) {
          console.error('创建临时图标文件失败:', error)
          if (error.code === 'EACCES') {
            throw new Error('没有足够的权限创建临时文件，请尝试以管理员身份运行应用')
          }
          throw error
        }
      }
      
      // 使用命令行版本的fileicon设置文件夹图标
      try {
        await execFileAsync('fileicon', ['set', folderPath, finalIconPath])
        
        // 刷新Finder缓存以便立即显示
        await execFileAsync('touch', [folderPath])
        
        // 通知渲染进程成功
        mainWindow.webContents.send('icon-applied')
        
        return { success: true }
      } catch (error: any) {
        console.error('设置图标失败:', error)
        if (error.code === 'ENOENT') {
          throw new Error('找不到fileicon命令。请使用 sudo npm install -g fileicon 安装')
        } else if (error.code === 'EACCES') {
          throw new Error('没有足够的权限修改文件夹图标，请尝试以管理员身份运行应用')
        }
        throw error
      }
    } catch (error: any) {
      console.error('应用图标失败:', error)
      mainWindow.webContents.send('icon-apply-error', error.message)
      throw error
    }
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
