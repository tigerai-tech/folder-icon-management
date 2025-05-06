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
      devTools: true,
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
            
            // 尝试从多个可能的位置找到图标
            let iconFound = false;
            
            // 尝试查找图标的所有可能路径（优先级从高到低）
            const possibleLocations = [
              // 1. 在开发环境中检查相对路径
              is.dev ? join(process.cwd(), 'build/extra-resources/icons', iconBasename) : null,
              
              // 2. app.getPath('userData') 可能会存储用户数据
              join(app.getPath('userData'), 'icons', iconBasename),
              
              // 3. 从extraResources找
              join(process.resourcesPath, 'icons', iconBasename),
              
              // 4. 从应用资源目录找
              join(process.resourcesPath, 'app.asar.unpacked', 'build', 'extra-resources', 'icons', iconBasename),
              
              // 5. 从resources/icons目录找
              join(process.resourcesPath, 'icons', iconBasename),
              
              // 6. 直接从extra-resources目录找
              join(process.resourcesPath, 'app.asar.unpacked', 'extra-resources', 'icons', iconBasename),
              
              // 7. 尝试简单的相对路径
              iconPath,
              
              // 8. 尝试从app.asar.unpacked找
              finalIconPath.replace('app.asar', 'app.asar.unpacked'),
              
              // 9. 尝试使用默认图标 (多种可能的位置)
              join(process.resourcesPath, 'icons', 'default.png'),
              join(process.resourcesPath, 'app.asar.unpacked', 'build', 'icons', 'default.png'),
              join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'icons', 'default.png'),
              
              // 10. 最后使用应用图标（通常一定可用）
              join(process.resourcesPath, 'icon.png')
            ].filter(Boolean); // 过滤掉null值
            
            console.log('主进程: 尝试查找图标的所有可能路径:', possibleLocations);
            
            for (const location of possibleLocations) {
              console.log('主进程: 尝试查找图标位置:', location);
              if (fsSync.existsSync(location)) {
                console.log('主进程: 找到图标位置:', location);
                await fs.copyFile(location, tempIconPath);
                iconFound = true;
                realIconPath = tempIconPath;
                break;
              }
            }
            
            // 如果都找不到，复制内部图标到临时目录（从应用资源目录）
            if (!iconFound) {
              console.log('使用应用内置默认图标');
              // 使用默认图标 - 从resources中提取
              const defaultIconPath = join(process.cwd(), 'resources', 'icon.png');
              if (fsSync.existsSync(defaultIconPath)) {
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

  // 处理将内置图标复制到Downloads目录
  ipcMain.handle('copy-icon-to-downloads', async (_, iconPath) => {
    console.log('主进程: 准备复制图标到Downloads文件夹:', iconPath);
    
    try {
      // 获取Downloads文件夹路径
      const downloadsPath = app.getPath('downloads');
      console.log('主进程: 下载文件夹路径:', downloadsPath);
      
      // 如果是URL格式的图标，转换为文件
      if (iconPath.startsWith('data:') || iconPath.startsWith('blob:')) {
        try {
          // 使用用户可访问的临时目录
          const tempDir = app.getPath('temp');
          const randomName = `temp_icon_${Date.now()}.png`;
          const tempPath = join(tempDir, randomName);
          
          // 从Base64提取数据部分
          const base64Data = iconPath.split(',')[1];
          if (base64Data) {
            await fs.writeFile(tempPath, Buffer.from(base64Data, 'base64'));
            
            // 生成目标文件名
            const timestamp = Date.now();
            const targetFileName = `icon_${timestamp}_base64.png`;
            const targetPath = join(downloadsPath, targetFileName);
            
            // 复制文件到Downloads文件夹
            await fs.copyFile(tempPath, targetPath);
            
            // 清理临时文件
            await fs.unlink(tempPath);
            
            return {
              success: true,
              filePath: targetPath,
              fileName: targetFileName
            };
          } else {
            throw new Error('无效的图标数据格式');
          }
        } catch (error: any) {
          console.error('创建临时图标文件失败:', error);
          throw error;
        }
      } else {
        // 处理文件路径或asar内资源的情况
        
        // 提取图标文件名
        let iconFileName = '';
        let sourceImagePath = '';
        
        // 处理不同类型的路径
        if (iconPath.startsWith('/@fs/')) {
          // Vite开发模式下的路径: /@fs/Users/user/project/...
          // 去除/@fs/前缀，获取实际路径
          sourceImagePath = iconPath.substring(4).split('?')[0];
          iconFileName = path.basename(sourceImagePath);
        } else if (iconPath.startsWith('file://')) {
          // 文件协议URL
          sourceImagePath = decodeURIComponent(iconPath.replace('file://', '')).split('?')[0];
          iconFileName = path.basename(sourceImagePath);
        } else if (iconPath.includes('/build/extra-resources/icons/') || iconPath.includes('/icons/')) {
          // 处理相对路径或特定路径模式
          // 提取图标文件名
          const matches = iconPath.match(/\/(icons|build\/extra-resources\/icons)\/([^/?]+)/);
          if (matches && matches[2]) {
            iconFileName = matches[2];
          } else {
            iconFileName = path.basename(iconPath.split('?')[0]);
          }
          
          // 尝试从不同位置查找图标文件
          console.log('解析出的图标文件名:', iconFileName);
          
          // 构建可能的图标路径
          const possiblePaths: string[] = [];
          
          if (app.isPackaged) {
            // 生产环境 - 应用已打包
            console.log('生产环境: 查找打包资源');
            
            // 从 app.asar 和 resources 目录查找
            const resourcesPath = process.resourcesPath;
            
            // 资源目录中的图标文件夹
            possiblePaths.push(join(resourcesPath, 'icons', iconFileName));
            
            // asar包根目录
            const appPath = app.getAppPath(); // 指向 app.asar
            possiblePaths.push(join(appPath, 'build', 'extra-resources', 'icons', iconFileName));
            
            // asar.unpacked 目录 (不会被压缩到asar的文件)
            const unpackedPath = appPath.replace('app.asar', 'app.asar.unpacked');
            possiblePaths.push(join(unpackedPath, 'build', 'extra-resources', 'icons', iconFileName));
            possiblePaths.push(join(unpackedPath, 'resources', 'icons', iconFileName));
            
            // 直接从__dirname尝试定位
            possiblePaths.push(join(__dirname, '..', 'icons', iconFileName));
            possiblePaths.push(join(__dirname, '../..', 'icons', iconFileName));
          } else {
            // 开发环境
            console.log('开发环境: 查找开发资源');
            
            // 项目根目录 (通常是package.json所在目录)
            const rootPath = app.getAppPath();
            possiblePaths.push(join(rootPath, 'build', 'extra-resources', 'icons', iconFileName));
            possiblePaths.push(join(rootPath, 'resources', 'icons', iconFileName));
            possiblePaths.push(join(rootPath, 'public', 'icons', iconFileName));
            
            // 开发环境下可能的其他位置
            possiblePaths.push(join(process.cwd(), 'build', 'extra-resources', 'icons', iconFileName));
          }
          
          // 当作绝对路径直接尝试
          possiblePaths.push(iconPath.split('?')[0]);
          
          // 检查所有可能的路径
          let iconFound = false;
          
          console.log('主进程: 尝试查找图标的所有可能路径:', possiblePaths);
          
          for (const testPath of possiblePaths) {
            console.log('尝试路径:', testPath);
            if (fsSync.existsSync(testPath)) {
              console.log('图标文件找到:', testPath);
              sourceImagePath = testPath;
              iconFound = true;
              break;
            }
          }
          
          if (!iconFound) {
            console.error('无法找到图标文件:', iconFileName);
            throw new Error(`无法找到图标文件: ${iconFileName}。请选择其他图标或联系支持团队。`);
          }
        } else {
          // 尝试作为直接文件路径处理
          sourceImagePath = iconPath;
          iconFileName = path.basename(sourceImagePath);
        }
        
        // 确保源路径有效
        if (!sourceImagePath || !fsSync.existsSync(sourceImagePath)) {
          console.error('源图标文件不存在:', sourceImagePath);
          throw new Error(`源图标文件不存在: ${sourceImagePath}`);
        }
        
        console.log('主进程: 源图标文件存在:', sourceImagePath);
        
        // 生成唯一的目标文件名
        const timestamp = Date.now();
        const targetFileName = `icon_${timestamp}_${iconFileName.replace(/[^\w.-]/g, '_')}`;
        const targetPath = join(downloadsPath, targetFileName);
        console.log('主进程: 目标文件路径:', targetPath);
        
        // 复制文件到Downloads文件夹
        await fs.copyFile(sourceImagePath, targetPath);
        
        console.log('主进程: 图标已复制到Downloads文件夹:', targetPath);
        
        // 返回复制后的文件路径
        return {
          success: true,
          filePath: targetPath,
          fileName: targetFileName
        };
      }
    } catch (error: any) {
      console.error('复制图标到Downloads文件夹失败:', error);
      return {
        success: false,
        error: error.message || '复制图标失败'
      };
    }
  });

  // 处理重置文件夹图标（取消自定义图标）
  ipcMain.handle('reset-folder-icon', async (_, folderPath) => {
    console.log('主进程: 重置文件夹图标:', folderPath);
    
    try {
      // 验证文件夹路径
      try {
        const stats = await fs.stat(folderPath);
        if (!stats.isDirectory()) {
          throw new Error('所选路径不是有效的文件夹');
        }
      } catch (error: any) {
        console.error(`检查文件夹错误: ${error.message}`);
        if (error.code === 'ENOENT') {
          throw new Error(`找不到文件夹: ${folderPath}`);
        }
        throw error;
      }
      
      // 获取fileicon工具路径
      const fileiconPath = getInternalFileiconPath();
      console.log(`使用fileicon工具重置图标: ${fileiconPath}`);
      
      // 检查fileicon工具是否存在
      try {
        await fs.access(fileiconPath, fs.constants.F_OK | fs.constants.X_OK);
      } catch (accessError) {
        console.error('fileicon工具不存在或没有执行权限:', accessError);
        throw new Error('内部fileicon工具无法访问。请重新安装应用或联系支持团队。');
      }
      
      // 设置执行权限
      try {
        await fs.chmod(fileiconPath, 0o755);
      } catch (chmodError) {
        console.error('无法设置fileicon工具的执行权限:', chmodError);
        throw new Error('无法设置内部工具的执行权限。请以管理员身份运行应用。');
      }
      
      // 在生产环境下，临时复制fileicon到临时目录确保有执行权限
      let execPath = fileiconPath;
      if (!is.dev) {
        const tempDir = app.getPath('temp');
        const tempFileiconPath = join(tempDir, `fileicon_${Date.now()}`);
        
        // 复制文件到临时目录
        try {
          await fs.copyFile(fileiconPath, tempFileiconPath);
          await fs.chmod(tempFileiconPath, 0o755);
          execPath = tempFileiconPath;
          console.log('使用临时fileicon路径:', execPath);
        } catch (copyError) {
          console.error('复制fileicon文件失败:', copyError);
          // 继续使用原路径
        }
      }
      
      // 执行fileicon命令，使用remove参数
      // 注意：fileicon remove 命令用于删除自定义图标，恢复默认图标
      try {
        console.log('执行命令:', execPath, ['remove', folderPath]);
        const result = await execFileAsync(execPath, ['remove', folderPath]);
        console.log('fileicon执行结果:', result);
        
        // 如果用了临时文件，尝试清理
        if (execPath !== fileiconPath) {
          fs.unlink(execPath).catch(e => console.warn('清理临时文件失败:', e));
        }
        
        // 刷新Finder缓存以便立即显示
        try {
          await execFileAsync('touch', [folderPath]);
        } catch (touchError: any) {
          console.warn('刷新Finder缓存失败:', touchError);
          // 这不是关键错误，可以继续
        }
        
        return { success: true, message: '文件夹图标已成功重置为默认' };
      } catch (execError: any) {
        console.error('执行fileicon remove工具失败:', execError);
        
        // 更具体的错误信息
        if (execError.code === 'ENOENT') {
          throw new Error(`找不到fileicon工具: ${execPath}`);
        } else if (execError.code === 'EACCES') {
          throw new Error(`没有权限执行fileicon工具。请尝试以管理员身份运行应用或重新安装应用。`);
        } else {
          throw new Error(`重置图标失败: ${execError.message || '未知错误'}`);
        }
      }
    } catch (error: any) {
      console.error('重置图标失败:', error);
      throw error;
    }
  });

  // 获取内部图标文件的真实路径（不复制到Downloads）
  ipcMain.handle('get-internal-icon-path', async (_, iconPath) => {
    console.log('主进程: 获取内部图标真实路径:', iconPath);
    
    try {
      // 处理不同类型的路径情况
      let realIconPath = '';
      
      // 如果是data:或blob:URL，需要创建临时文件
      if (iconPath.startsWith('data:') || iconPath.startsWith('blob:')) {
        try {
          // 使用用户可访问的临时目录
          const tempDir = app.getPath('temp');
          const randomName = `temp_icon_${Date.now()}.png`;
          const tempPath = join(tempDir, randomName);
          
          // 从Base64提取数据部分
          const base64Data = iconPath.split(',')[1];
          if (base64Data) {
            await fs.writeFile(tempPath, Buffer.from(base64Data, 'base64'));
            realIconPath = tempPath;
          } else {
            throw new Error('无效的图标数据格式');
          }
        } catch (error: any) {
          console.error('创建临时图标文件失败:', error);
          throw error;
        }
      } else {
        // 处理文件路径或asar内资源的情况
        
        // 提取图标文件名
        let iconFileName = '';
        
        // 处理不同类型的路径
        if (iconPath.startsWith('/@fs/')) {
          // Vite开发模式下的路径: /@fs/Users/user/project/...
          // 去除/@fs/前缀，获取实际路径
          realIconPath = iconPath.substring(4).split('?')[0];
          iconFileName = path.basename(realIconPath);
        } else if (iconPath.startsWith('file://')) {
          // 文件协议URL
          realIconPath = decodeURIComponent(iconPath.replace('file://', '')).split('?')[0];
          iconFileName = path.basename(realIconPath);
        } else if (iconPath.includes('/build/extra-resources/icons/') || iconPath.includes('/icons/')) {
          // 处理相对路径或特定路径模式
          // 提取图标文件名
          const matches = iconPath.match(/\/(icons|build\/extra-resources\/icons)\/([^/?]+)/);
          if (matches && matches[2]) {
            iconFileName = matches[2];
          } else {
            iconFileName = path.basename(iconPath.split('?')[0]);
          }
          
          // 尝试从不同位置查找图标文件
          console.log('解析出的图标文件名:', iconFileName);
          
          // 构建可能的图标路径
          const possiblePaths: string[] = [];
          
          if (app.isPackaged) {
            // 生产环境 - 应用已打包
            console.log('生产环境: 查找打包资源');
            
            // 从 app.asar 和 resources 目录查找
            const resourcesPath = process.resourcesPath;
            
            // 资源目录中的图标文件夹
            possiblePaths.push(join(resourcesPath, 'icons', iconFileName));
            
            // asar包根目录
            const appPath = app.getAppPath(); // 指向 app.asar
            possiblePaths.push(join(appPath, 'build', 'extra-resources', 'icons', iconFileName));
            
            // asar.unpacked 目录 (不会被压缩到asar的文件)
            const unpackedPath = appPath.replace('app.asar', 'app.asar.unpacked');
            possiblePaths.push(join(unpackedPath, 'build', 'extra-resources', 'icons', iconFileName));
            possiblePaths.push(join(unpackedPath, 'resources', 'icons', iconFileName));
            
            // 直接从__dirname尝试定位
            possiblePaths.push(join(__dirname, '..', 'icons', iconFileName));
            possiblePaths.push(join(__dirname, '../..', 'icons', iconFileName));
          } else {
            // 开发环境
            console.log('开发环境: 查找开发资源');
            
            // 项目根目录 (通常是package.json所在目录)
            const rootPath = app.getAppPath();
            possiblePaths.push(join(rootPath, 'build', 'extra-resources', 'icons', iconFileName));
            possiblePaths.push(join(rootPath, 'resources', 'icons', iconFileName));
            possiblePaths.push(join(rootPath, 'public', 'icons', iconFileName));
            
            // 开发环境下可能的其他位置
            possiblePaths.push(join(process.cwd(), 'build', 'extra-resources', 'icons', iconFileName));
          }
          
          // 当作绝对路径直接尝试
          possiblePaths.push(iconPath.split('?')[0]);
          
          // 检查所有可能的路径
          let iconFound = false;
          
          console.log('主进程: 尝试查找图标的所有可能路径:', possiblePaths);
          
          for (const testPath of possiblePaths) {
            console.log('尝试路径:', testPath);
            if (fsSync.existsSync(testPath)) {
              console.log('图标文件找到:', testPath);
              realIconPath = testPath;
              iconFound = true;
              break;
            }
          }
          
          if (!iconFound) {
            console.error('无法找到图标文件:', iconFileName);
            throw new Error(`无法找到图标文件: ${iconFileName}。请选择其他图标或联系支持团队。`);
          }
        } else {
          // 尝试作为直接文件路径处理
          realIconPath = iconPath;
        }
        
        // 确保源路径有效
        if (!realIconPath || !fsSync.existsSync(realIconPath)) {
          console.error('源图标文件不存在:', realIconPath);
          throw new Error(`源图标文件不存在: ${realIconPath}`);
        }
      }
      
      console.log('主进程: 找到的内部图标真实路径:', realIconPath);
      
      return {
        success: true,
        iconPath: realIconPath
      };
    } catch (error: any) {
      console.error('获取内部图标路径失败:', error);
      return {
        success: false,
        error: error.message || '获取内部图标路径失败'
      };
    }
  });

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
  ipcMain.removeHandler('copy-icon-to-downloads');
  ipcMain.removeHandler('reset-folder-icon');
  ipcMain.removeHandler('get-internal-icon-path');
  
  // 重置IPC处理程序注册标志
  ipcHandlersRegistered = false;
  
  console.log('资源清理完成');
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
