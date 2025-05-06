import { app, shell, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { promises as fs } from 'fs'
import * as fsSync from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import icon from '../renderer/src/assets/icon.svg?asset'
import path from 'path'
import crypto from 'crypto'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream'
import { promisify as utilPromisify } from 'util'
import axios from 'axios'

// 使用promisify转换execFile为Promise版本
const execFileAsync = promisify(execFile)
// 转换 pipeline 为 Promise 版本
const streamPipeline = utilPromisify(pipeline)

// 获取内部fileicon工具路径
const getInternalFileiconPath = (): string => {
  // 开发环境和生产环境的路径不同
  if (is.dev) {
    return join(process.cwd(), 'resources', 'lib', 'fileicon')
  } else {
    // 生产环境，相对于应用程序包
    const resourcesPath = process.resourcesPath
    
    // 先尝试从extraResources路径获取
    const extraResourcesPath = join(resourcesPath, 'lib', 'fileicon')
    if (fsSync.existsSync(extraResourcesPath)) {
      console.log('使用extraResources路径:', extraResourcesPath)
      return extraResourcesPath
    }
    
    // 备选：从app.asar.unpacked路径获取
    const unpackedPath = resourcesPath.replace('app.asar', 'app.asar.unpacked')
    const unpackedFileiconPath = join(unpackedPath, 'resources', 'lib', 'fileicon')
    
    console.log('备选路径:', unpackedFileiconPath)
    return unpackedFileiconPath
  }
}

// 获取应用资源图标路径
const getResourceIconPath = (iconName: string): string | null => {
  // 尝试从各种可能的位置找到图标
  const possibleLocations = [
    // 开发环境
    join(process.cwd(), 'resources', 'icons', iconName),
    // 生产环境 - extraResources
    join(process.resourcesPath, 'icons', iconName),
    // 生产环境 - app.asar.unpacked
    join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'icons', iconName),
    // 默认图标
    join(process.resourcesPath, 'icons', 'default.png'),
    join(process.cwd(), 'resources', 'icon.png')
  ];
  
  for (const location of possibleLocations) {
    if (fsSync.existsSync(location)) {
      console.log(`找到图标: ${location}`);
      return location;
    }
  }
  
  console.error(`无法找到图标: ${iconName}`);
  return null;
}

// 定义全局IPC处理程序注册标志，防止重复注册
let ipcHandlersRegistered = false;

function createWindow(): BrowserWindow {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    title: 'Mac Folder Icon Manager',
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
          "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: file:;"
        ]
      }
    });
  });

  // 只在开发环境下打开开发者工具
  if (is.dev) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    console.log('主窗口已显示')
  })

  // 监听窗口关闭事件
  mainWindow.on('closed', () => {
    console.log('主窗口已关闭')
  })

  // 监听窗口即将关闭事件
  mainWindow.on('close', () => {
    console.log('主窗口即将关闭')
    
    // 在 macOS 中，当用户关闭窗口时，通常期望应用程序仍然保持活动状态
    // 但如果是显式退出（如通过 Command+Q），则应用应该退出
    if (process.platform !== 'darwin') {
      app.quit()
    }
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
  
  // 创建应用菜单
  createAppMenu(mainWindow)
  
  return mainWindow
}

// 设置IPC处理程序
function setupIpcHandlers(mainWindow: BrowserWindow): void {
  // 防止重复注册处理程序
  if (ipcHandlersRegistered) {
    console.log('IPC处理程序已经注册，跳过重复注册');
    return;
  }
  
  console.log('注册IPC处理程序');
  
  // 处理选择文件夹对话框
  ipcMain.handle('select-folder', async () => {
    console.log('主进程: 打开选择文件夹对话框')
    
    // 检查窗口是否已销毁
    if (mainWindow.isDestroyed()) {
      console.log('窗口已销毁，取消操作');
      return null;
    }
    
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

  // 处理选择图标文件对话框
  ipcMain.handle('select-icon-file', async () => {
    console.log('主进程: 打开选择图标文件对话框')
    
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'svg'] }
      ],
      title: '选择图标文件'
    })
    
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0]
      console.log('主进程: 用户选择了图标文件:', filePath)
      return filePath
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
      console.log(`正在处理文件夹: ${folderPath}`)
      console.log(`正在使用ICON: ${iconPath}`)
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
        // 获取内部fileicon工具的路径
        const fileiconPath = getInternalFileiconPath()
        console.log(`使用内部fileicon工具: ${fileiconPath}`)
        
        // 检查fileicon工具是否存在
        try {
          await fs.access(fileiconPath, fs.constants.F_OK | fs.constants.X_OK)
        } catch (accessError) {
          console.error('fileicon工具不存在或没有执行权限:', accessError)
          throw new Error('内部fileicon工具无法访问。请重新安装应用或联系支持团队。')
        }
        
        // 设置执行权限
        try {
          await fs.chmod(fileiconPath, 0o755)
        } catch (chmodError) {
          console.error('无法设置fileicon工具的执行权限:', chmodError)
          throw new Error('无法设置内部工具的执行权限。请以管理员身份运行应用。')
        }
        
        // 处理图标路径问题
        let realIconPath = finalIconPath;
        
        // 如果路径是app.asar内部的路径，需要特殊处理
        if (finalIconPath.includes('app.asar')) {
          console.log('检测到asar内部图标路径，需要特殊处理');
          
          // 从URL协议中提取实际路径
          if (finalIconPath.startsWith('file://')) {
            finalIconPath = finalIconPath.replace('file://', '');
          }
          
          // URL解码路径
          finalIconPath = decodeURIComponent(finalIconPath);
          
          try {
            // 创建临时文件作为替代
            const tempDir = app.getPath('temp');
            const tempIconPath = join(tempDir, `temp_icon_${Date.now()}.png`);
            
            // 提取图标名称用于从资源目录查找
            const iconBasename = path.basename(finalIconPath);
            
            // 使用辅助函数查找图标
            const resourceIconPath = getResourceIconPath(iconBasename);
            
            if (resourceIconPath) {
              // 使用找到的资源图标
              await fs.copyFile(resourceIconPath, tempIconPath);
              realIconPath = tempIconPath;
            } else {
              // 如果找不到特定图标，尝试使用默认图标
              console.log('使用应用内置默认图标');
              const defaultIconPath = getResourceIconPath('default.png');
              
              if (defaultIconPath) {
                await fs.copyFile(defaultIconPath, tempIconPath);
                realIconPath = tempIconPath;
              } else {
                throw new Error('无法找到任何可用的图标文件');
              }
            }
          } catch (error: any) {
            console.error('处理图标路径失败:', error);
            throw new Error(`无法处理图标文件: ${error.message}`);
          }
        }
        
        // 验证参数
        if (!folderPath || !fsSync.existsSync(folderPath)) {
          throw new Error(`文件夹路径无效或不存在: ${folderPath}`)
        }
        
        if (!realIconPath || !fsSync.existsSync(realIconPath)) {
          throw new Error(`图标文件路径无效或不存在: ${realIconPath}`)
        }
        
        // 使用内部fileicon工具
        try {
          console.log('执行命令:', fileiconPath, ['set', folderPath, realIconPath])
          
          // 在生产环境下，临时复制fileicon到临时目录确保有执行权限
          let execPath = fileiconPath
          if (!is.dev) {
            const tempDir = app.getPath('temp')
            const tempFileiconPath = join(tempDir, `fileicon_${Date.now()}`)
            
            // 复制文件到临时目录
            try {
              await fs.copyFile(fileiconPath, tempFileiconPath)
              await fs.chmod(tempFileiconPath, 0o755)
              execPath = tempFileiconPath
              console.log('使用临时fileicon路径:', execPath)
            } catch (copyError) {
              console.error('复制fileicon文件失败:', copyError)
              // 继续使用原路径
            }
          }
          
          // 执行fileicon命令
          const result = await execFileAsync(execPath, ['set', folderPath, realIconPath])
          console.log('fileicon执行结果:', result)
          
          // 如果用了临时文件，尝试清理
          if (execPath !== fileiconPath) {
            fs.unlink(execPath).catch(e => console.warn('清理临时文件失败:', e))
          }
          
          // 如果使用了临时图标文件，尝试清理
          if (realIconPath !== finalIconPath) {
            fs.unlink(realIconPath).catch(e => console.warn('清理临时图标文件失败:', e))
          }
          
          // 刷新Finder缓存以便立即显示
          try {
            await execFileAsync('touch', [folderPath])
          } catch (touchError: any) {
            console.warn('刷新Finder缓存失败:', touchError)
            // 这不是关键错误，可以继续
          }
          
          // 在发送消息前检查窗口是否还存在
          if (!mainWindow.isDestroyed()) {
            // 通知渲染进程成功
            mainWindow.webContents.send('icon-applied')
          } else {
            console.log('主窗口已关闭，无法发送成功消息')
          }
          
          return { success: true }
        } catch (execError: any) {
          console.error('执行fileicon工具失败:', execError)
          
          // 更具体的错误信息
          if (execError.code === 'ENOENT') {
            throw new Error(`找不到fileicon工具: ${fileiconPath}`)
          } else if (execError.code === 'EACCES') {
            throw new Error(`没有权限执行fileicon工具。请尝试以管理员身份运行应用或重新安装应用。`)
          } else {
            throw new Error(`设置图标失败: ${execError.message || '未知错误'}`)
          }
        }
      } catch (error: any) {
        console.error('设置图标失败:', error)
        if (error.code === 'ENOENT') {
          throw new Error('内部fileicon工具无法执行。请尝试以管理员身份运行应用')
        } else if (error.code === 'EACCES') {
          throw new Error('没有足够的权限修改文件夹图标，请尝试以管理员身份运行应用')
        }
        throw error
      }
    } catch (error: any) {
      console.error('应用图标失败:', error)
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('icon-apply-error', error.message)
      } else {
        console.log('主窗口已关闭，无法发送错误消息')
      }
      throw error
    }
  })

  // 处理读取文件并转为base64的请求
  ipcMain.handle('read-file', async (_, filePath) => {
    console.log('主进程: 读取文件:', filePath)
    
    try {
      // 读取文件为Buffer
      const data = await fs.readFile(filePath)
      
      // 获取文件类型
      const ext = filePath.split('.').pop()?.toLowerCase() || 'png'
      let mimeType = 'image/png'
      
      // 设置正确的MIME类型
      if (ext === 'jpg' || ext === 'jpeg') {
        mimeType = 'image/jpeg'
      } else if (ext === 'svg') {
        mimeType = 'image/svg+xml'
      }
      
      // 转换为base64并返回数据URL
      const base64Data = data.toString('base64')
      const dataUrl = `data:${mimeType};base64,${base64Data}`
      
      console.log('主进程: 文件读取成功')
      return { success: true, data: dataUrl }
    } catch (error: any) {
      console.error('读取文件失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 处理从URL下载图标
  ipcMain.handle('download-icon-from-url', async (_, url) => {
    console.log('主进程: 从URL下载图标:', url)
    
    try {
      // 获取Downloads文件夹路径
      const downloadsPath = app.getPath('downloads')
      
      // 从URL中提取文件名
      let fileName = path.basename(url).split('?')[0]
      
      // 如果无法从URL获取有效文件名，生成随机文件名
      if (!fileName || fileName.length < 3 || !fileName.includes('.')) {
        // 生成随机文件名
        const hash = crypto.createHash('md5').update(url + Date.now().toString()).digest('hex').substring(0, 8)
        fileName = `icon_${hash}.png`
      }
      
      // 确保文件名唯一
      const timestamp = Date.now()
      const fileNameWithoutExt = path.basename(fileName, path.extname(fileName))
      const fileExt = path.extname(fileName) || '.png'
      const uniqueFileName = `${fileNameWithoutExt}_${timestamp}${fileExt}`
      
      // 构建完整文件路径
      const filePath = path.join(downloadsPath, uniqueFileName)
      
      console.log('主进程: 下载图标到路径:', filePath)
      
      // 使用axios下载文件
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: 15000, // 15秒超时
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      })
      
      // 检查响应状态
      if (response.status !== 200) {
        throw new Error(`下载失败，HTTP状态码: ${response.status}`)
      }
      
      // 检查内容类型是否为图片
      const contentType = response.headers['content-type']
      if (!contentType || !contentType.startsWith('image/')) {
        throw new Error(`下载的不是图片文件，内容类型: ${contentType}`)
      }
      
      // 创建写入流并保存文件
      const writer = createWriteStream(filePath)
      await streamPipeline(response.data, writer)
      
      console.log('主进程: 图标下载成功')
      
      // 在这里添加通知消息 (如果需要)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('icon-download-complete', {
          filePath,
          fileName: uniqueFileName
        })
      }
      
      return {
        success: true,
        filePath,
        fileName: uniqueFileName
      }
    } catch (error: any) {
      console.error('下载图标失败:', error)
      
      // 在这里添加错误通知消息 (如果需要)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('icon-download-error', error.message || '下载图标时发生错误')
      }
      
      return {
        success: false,
        error: error.message || '下载图标时发生错误'
      }
    }
  })

  // 处理打开外部URL
  ipcMain.on('open-external-url', (_, url) => {
    console.log('主进程: 打开外部URL:', url)
    shell.openExternal(url)
  })

  // 标记处理程序已注册
  ipcHandlersRegistered = true;
}

// 创建应用菜单
function createAppMenu(mainWindow: BrowserWindow): void {
  const isMac = process.platform === 'darwin'
  
  const template = [
    // App菜单 (仅macOS)
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const }
      ]
    }] : []),
    // 文件菜单
    {
      label: '文件',
      submenu: [
        isMac ? { role: 'close' as const } : { role: 'quit' as const }
      ]
    },
    // 编辑菜单
    {
      label: '编辑',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' as const },
          { role: 'delete' as const },
          { role: 'selectAll' as const },
        ] : [
          { role: 'delete' as const },
          { type: 'separator' as const },
          { role: 'selectAll' as const }
        ])
      ]
    },
    // 视图菜单
    {
      label: '视图',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const }
      ]
    },
    // 窗口菜单
    {
      label: '窗口',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const },
          { type: 'separator' as const },
          { role: 'window' as const }
        ] : [
          { role: 'close' as const }
        ])
      ]
    },
    // 帮助菜单
    {
      role: 'help' as const,
      submenu: [
        {
          label: '关于',
          click: async () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于 Mac Folder Icon Manager',
              message: 'Mac Folder Icon Manager v1.0.0',
              detail: '一个用于管理Mac文件夹图标的应用程序。\n\n© 2024 All Rights Reserved.'
            })
          }
        }
      ]
    }
  ]
  
  const menu = Menu.buildFromTemplate(template as Electron.MenuItemConstructorOptions[])
  Menu.setApplicationMenu(menu)
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 检查fileicon工具可用性
  try {
    const fileiconPath = getInternalFileiconPath()
    console.log('fileicon工具路径:', fileiconPath)
    
    if (fsSync.existsSync(fileiconPath)) {
      console.log('fileicon工具存在')
      
      try {
        await fs.chmod(fileiconPath, 0o755)
        console.log('已设置fileicon工具执行权限')
      } catch (error) {
        console.error('无法设置fileicon工具执行权限:', error)
      }
    } else {
      console.error('fileicon工具不存在')
    }
  } catch (error) {
    console.error('检查fileicon工具时出错:', error)
  }

  // 创建主窗口
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
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

// 添加退出事件清理
app.on('before-quit', () => {
  console.log('应用即将退出，清理资源...');
  
  // 移除所有IPC处理程序
  ipcMain.removeHandler('select-folder');
  ipcMain.removeHandler('select-icon-file');
  ipcMain.removeHandler('check-path');
  ipcMain.removeHandler('apply-icon');
  ipcMain.removeHandler('read-file');
  ipcMain.removeHandler('download-icon-from-url');
  
  // 重置IPC处理程序注册标志
  ipcHandlersRegistered = false;
  
  console.log('资源清理完成');
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
