import { app, shell, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { join, basename } from 'path'
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
import ConfigManager from './utils/configManager'
import DatabaseManager from './utils/databaseManager'

// 使用promisify转换execFile为Promise版本
const execFileAsync = promisify(execFile)
// 转换 pipeline 为 Promise 版本
const streamPipeline = utilPromisify(pipeline)

// 提升为全局变量，便于在整个应用中使用
const configManager = new ConfigManager();
let databaseManager: DatabaseManager | null = null;

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

// 获取用户自定义图标目录
const getCustomIconsDirectory = async (): Promise<string> => {
  // 获取工作目录
  const workspacePath = await configManager.getWorkspacePath();
  if (!workspacePath) {
    console.error('未设置工作目录');
    return '';
  }
  
  const customIconsDir = path.join(workspacePath, 'source-icons');
  
  // 确保目录存在
  try {
    if (!fsSync.existsSync(customIconsDir)) {
      await fs.mkdir(customIconsDir, { recursive: true });
      console.log('已创建自定义图标目录:', customIconsDir);
    }
  } catch (error) {
    console.error('创建自定义图标目录失败:', error);
  }
  
  return customIconsDir;
};

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
    mainWindow.webContents.openDevTools();
  }
  
  // 添加快捷键切换开发者工具，方便在生产环境中调试
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // Cmd+Opt+I (Mac) 或 Ctrl+Shift+I (Windows/Linux)
    if ((input.control || input.meta) && (input.shift || input.alt) && input.key === 'i') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });
  
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

  // 处理工作目录选择
  ipcMain.handle('select-workspace', async () => {
    console.log('主进程: 打开选择工作目录对话框');
    
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: '选择工作目录'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      const workspacePath = result.filePaths[0];
      
      try {
        // 更新配置中的工作目录
        await configManager.updateWorkspacePath(workspacePath);
        
        // 关闭旧的数据库连接
        if (databaseManager) {
          databaseManager.close();
        }
        
        // 使用新的工作目录创建数据库管理器
        databaseManager = new DatabaseManager(workspacePath);
        await databaseManager.initialize();
        
        console.log('工作目录已更新:', workspacePath);
        return { success: true, path: workspacePath };
      } catch (error) {
        console.error('更新工作目录失败:', error);
        return { success: false, error: (error as Error).message };
      }
    }
    
    return { success: false, error: '用户取消了选择' };
  });
  
  // 获取当前工作目录
  ipcMain.handle('get-workspace', () => {
    const workspacePath = configManager.getWorkspacePath();
    console.log('主进程: 获取工作目录:', workspacePath);
    return workspacePath;
  });
  
  // 获取已应用图标记录
  ipcMain.handle('get-applied-icons', () => {
    if (!databaseManager) {
      return { success: false, error: '数据库未初始化' };
    }
    
    try {
      const records = databaseManager.getAllIconApplications();
      return { success: true, records };
    } catch (error) {
      console.error('获取已应用图标记录失败:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 处理图标应用
  ipcMain.handle('apply-icon', async (_, args) => {
    try {
      const { folderPath, iconPath, iconName, isBuiltIn, originalIconPath } = args;
      
      console.log(`正在处理文件夹: ${folderPath}`);
      console.log(`正在使用ICON: ${iconPath}`);
      // 检查路径是否有效
      if (!folderPath || !iconPath) {
        throw new Error('无效的文件夹或图标路径');
      }
      
      // 确保目标是文件夹
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
      
      // 处理图标路径 - 特别是开发模式下的Vite特殊路径
      let finalIconPath = iconPath;
      
      // 处理Vite开发模式下的路径 (/@fs/path...)
      if (finalIconPath.startsWith('/@fs/')) {
        finalIconPath = finalIconPath.substring(4).split('?')[0];
        console.log(`处理Vite路径: ${finalIconPath}`);
      }
      
      // 处理file://协议路径
      if (finalIconPath.startsWith('file://')) {
        // 先进行URL解码
        finalIconPath = decodeURIComponent(finalIconPath);
        
        // 移除file://前缀，处理不同平台的差异
        if (process.platform === 'win32') {
          // Windows平台: file:///C:/path/to/file -> C:/path/to/file
          finalIconPath = finalIconPath.replace('file:///', '');
        } else {
          // 其他平台（macOS、Linux）: file:///path/to/file -> /path/to/file
          finalIconPath = finalIconPath.replace('file://', '');
        }
        
        // 移除可能存在的查询参数
        finalIconPath = finalIconPath.split('?')[0];
        
        console.log(`处理文件协议路径: ${finalIconPath}`);
        
        // 检查文件是否存在
        if (!fsSync.existsSync(finalIconPath)) {
          console.error(`文件不存在: ${finalIconPath}`);
          
          // 判断是否是打包后的资源路径
          const normalizedPath = finalIconPath.replace(/\\/g, '/'); // 统一为正斜杠方便检测
          const isOutAssetPath = normalizedPath.includes('/out/renderer/assets/');
          const isDistAssetPath = normalizedPath.includes('/dist/renderer/assets/');
          
          if (isOutAssetPath || isDistAssetPath) {
            console.log('检测到打包后的资源路径');
            
            // 提取文件名
            const iconBasename = path.basename(finalIconPath);
            console.log(`提取的文件名: ${iconBasename}`);
            
            // 检查根目录下的资源
            const rootAssetsPath = isOutAssetPath 
              ? join(process.cwd(), 'out', 'renderer', 'assets', iconBasename)
              : join(process.cwd(), 'dist', 'renderer', 'assets', iconBasename);
            
            if (fsSync.existsSync(rootAssetsPath)) {
              console.log(`找到打包后的资源: ${rootAssetsPath}`);
              finalIconPath = rootAssetsPath;
            } else {
              // 尝试从应用根目录定位
              const appRootPath = app.getAppPath();
              const appAssetsPath = isOutAssetPath
                ? join(appRootPath, '..', 'out', 'renderer', 'assets', iconBasename)
                : join(appRootPath, '..', 'dist', 'renderer', 'assets', iconBasename);
              
              if (fsSync.existsSync(appAssetsPath)) {
                console.log(`找到应用根目录的资源: ${appAssetsPath}`);
                finalIconPath = appAssetsPath;
              } else {
                console.log('无法找到打包后的资源，尝试创建临时图标');
                
                // 创建临时图标文件作为替代
                try {
                  const tempDir = app.getPath('temp');
                  const tempIconPath = join(tempDir, `temp_icon_${Date.now()}.png`);
                  
                  // 使用默认图标
                  const defaultIconPath = join(process.resourcesPath, 'icon.png');
                  if (fsSync.existsSync(defaultIconPath)) {
                    await fs.copyFile(defaultIconPath, tempIconPath);
                    finalIconPath = tempIconPath;
                    console.log(`使用默认图标: ${finalIconPath}`);
                  } else {
                    console.error('无法找到默认图标');
                  }
                } catch (error) {
                  console.error('创建临时图标文件失败:', error);
                }
              }
            }
          } else {
            // 尝试提取文件名，并在可能的位置查找
            const iconBasename = path.basename(finalIconPath);
            console.log(`尝试按文件名查找: ${iconBasename}`);
            
            // 在可能的位置查找
            const possibleLocations = [
              // 开发环境
              join(process.cwd(), 'resources', 'icons', iconBasename),
              join(process.cwd(), 'build', 'extra-resources', 'icons', iconBasename),
              
              // 用户数据目录
              join(app.getPath('userData'), 'icons', iconBasename),
              
              // 应用资源目录
              join(app.getAppPath(), 'assets', iconBasename),
              join(app.getAppPath(), 'renderer', 'assets', iconBasename),
              
              // 打包后资源目录
              join(__dirname, '..', 'renderer', 'assets', iconBasename),
              join(process.resourcesPath, 'assets', iconBasename),
              
              // 如果是Electron-Vite项目，尝试dist和out目录结构
              join(process.cwd(), 'dist', 'renderer', 'assets', iconBasename),
              join(process.cwd(), 'out', 'renderer', 'assets', iconBasename)
            ];
            
            console.log('尝试查找的位置:', possibleLocations);
            
            for (const loc of possibleLocations) {
              if (fsSync.existsSync(loc)) {
                console.log(`找到文件: ${loc}`);
                finalIconPath = loc;
                break;
              }
            }
          }
        }
      }
      
      // 如果是URL格式，需要下载到临时文件
      if (finalIconPath.startsWith('data:') || finalIconPath.startsWith('blob:')) {
        try {
          // 使用用户可访问的临时目录
          const tempDir = app.getPath('temp')
          const randomName = `icon_${Date.now()}.png`
          finalIconPath = join(tempDir, randomName)
          
          // 从Base64提取数据部分
          const base64Data = finalIconPath.split(',')[1]
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
              finalIconPath,
              
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
          console.error(`图标文件路径无效或不存在: ${realIconPath}`);
          console.log('创建备选的临时图标文件...');
          
          try {
            // 创建一个临时的纯色图标文件
            const tempDir = app.getPath('temp');
            const tempIconPath = join(tempDir, `fallback_icon_${Date.now()}.png`);
            
            // 使用默认图标（如果存在）
            const defaultIconPaths = [
              join(process.resourcesPath, 'icon.png'),
              join(process.cwd(), 'resources', 'icon.png'),
              join(app.getAppPath(), 'icon.png'),
              join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'icon.png')
            ];
            
            let defaultFound = false;
            for (const defaultPath of defaultIconPaths) {
              if (fsSync.existsSync(defaultPath)) {
                await fs.copyFile(defaultPath, tempIconPath);
                realIconPath = tempIconPath;
                defaultFound = true;
                console.log(`使用默认图标: ${defaultPath}`);
                break;
              }
            }
            
            if (!defaultFound) {
              // 如果找不到任何默认图标，使用Node.js创建一个简单的1x1像素PNG
              const onePixelPng = Buffer.from([
                0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
                0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
                0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
                0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
                0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D, 0xB0, 0x00, 0x00, 0x00,
                0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
              ]);
              
              await fs.writeFile(tempIconPath, onePixelPng);
              realIconPath = tempIconPath;
              console.log(`创建了简单的备选图标: ${tempIconPath}`);
            }
          } catch (error) {
            console.error('创建备选图标文件失败:', error);
            throw new Error(`图标文件路径无效或不存在，且无法创建备选图标: ${realIconPath}`);
          }
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
          
          // 成功应用图标后，记录到数据库
          console.log('检查数据库管理器状态:', databaseManager ? '已初始化' : '未初始化');
          
          let dbInitSuccessful = false;
          
          if (!databaseManager) {
            console.warn('数据库管理器未初始化，尝试重新初始化');
            // 尝试重新初始化数据库
            try {
              const workspacePath = configManager.getWorkspacePath();
              console.log('尝试使用工作目录重新初始化数据库:', workspacePath);
              
              // 检查工作目录是否存在
              try {
                const stats = await fs.stat(workspacePath);
                if (!stats.isDirectory()) {
                  console.error('工作目录不是一个有效的文件夹:', workspacePath);
                  throw new Error('工作目录不是一个有效的文件夹');
                }
              } catch (statError) {
                // 创建工作目录
                await fs.mkdir(workspacePath, { recursive: true });
                console.log('已创建工作目录:', workspacePath);
              }
              
              if (workspacePath) {
                databaseManager = new DatabaseManager(workspacePath);
                await databaseManager.initialize();
                console.log('数据库重新初始化成功');
                dbInitSuccessful = true;
              } else {
                console.error('无法获取工作目录，无法重新初始化数据库');
              }
            } catch (reinitError) {
              console.error('重新初始化数据库失败:', reinitError);
            }
          } else {
            dbInitSuccessful = true;
          }
          
          if (dbInitSuccessful) {
            try {
              // 确保应用图标目录存在
              if (databaseManager) {
                await fs.mkdir(databaseManager.getAppliedIconsPath(), { recursive: true });
                console.log('确保应用图标目录存在:', databaseManager.getAppliedIconsPath());
                
                // 删除旧icon
                await databaseManager.removeIconApplication(folderPath);
                console.log('已删除旧图标记录');

                // 复制图标到应用图标目录
                const destPath = await databaseManager.copyIconToAppliedDirectory(
                  finalIconPath,
                  iconName || basename(finalIconPath)
                );
                console.log('图标已复制到应用目录:', destPath);
                
                // 记录图标应用信息
                await databaseManager.recordIconApplication({
                  folderPath,
                  sourceIconName: iconName || basename(finalIconPath),
                  isBuiltIn: isBuiltIn || false,
                  iconPath: destPath,
                  originalIconPath: originalIconPath,
                  appliedAt: new Date().toISOString()
                });

                console.log('图标应用信息已成功记录到数据库');
              } else {
                console.error('数据库管理器仍然未初始化，无法记录图标应用信息');
              }
            } catch (dbError) {
              console.error('记录图标应用信息失败:', dbError);
              // 这里不抛出错误，因为图标已经成功应用，只是记录失败
            }
          } else {
            console.error('无法记录图标应用信息，数据库初始化失败');
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

  // 修改重置图标处理程序以删除数据库记录和图标文件
  ipcMain.handle('reset-icon', async (_, arg) => {
    console.log('主进程: 重置图标: start ---------')
    // 支持原有的字符串参数方式和新的对象参数方式
    const folderPath = typeof arg === 'string' ? arg : arg.folderPath;
    const deleteFile = typeof arg === 'object' && arg.deleteFile === true;

    console.log('主进程: 重置图标:', folderPath, '删除文件:', deleteFile);
    
    try {
      // 确保目标是文件夹
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
      
      // 获取内部fileicon工具的路径
      const fileiconPath = getInternalFileiconPath();
      console.log(`使用内部fileicon工具: ${fileiconPath}`);
      
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
      
      // 使用fileicon工具重置图标
      try {
        // 首先，如果数据库已初始化，从数据库中删除记录
        // 这样即使fileicon失败，我们也能清理数据库记录
        if (databaseManager) {
          try {
            if (deleteFile) {
              // 删除旧icon记录
              await databaseManager.removeIconApplication(folderPath);
              console.log('已从数据库中删除图标应用记录');
            }
          } catch (dbError) {
            console.error('从数据库删除记录失败:', dbError);
            // 不阻止流程继续
          }
        } else {
          console.warn('数据库管理器未初始化，尝试重新初始化');
          
          // 尝试重新初始化数据库管理器
          try {
            const workspacePath = configManager.getWorkspacePath();
            if (workspacePath) {
              databaseManager = new DatabaseManager(workspacePath);
              await databaseManager.initialize();
              console.log('数据库重新初始化成功');
              
              // 再次尝试删除记录
              if (deleteFile) {
                await databaseManager.removeIconApplication(folderPath);
                console.log('初始化后成功删除图标应用记录');
              }
            }
          } catch (reinitError) {
            console.error('重新初始化数据库失败:', reinitError);
          }
        }
        
        // 然后执行fileicon重置命令
        const result = await execFileAsync(execPath, ['rm', folderPath]);
        console.log('fileicon重置结果:', result);
        
        // 清理临时文件
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
        
        // 通知渲染进程成功
        mainWindow.webContents.send('icon-reset');
        
        return { success: true };
      } catch (execError: any) {
        console.error('执行fileicon重置命令失败:', execError);
        throw execError;
      }
    } catch (error: any) {
      console.error('重置图标失败:', error);
      mainWindow.webContents.send('icon-reset-error', error.message);
      throw error;
    }
  });

  // 一键恢复所有图标
  ipcMain.handle('restore-all-icons', async () => {
    console.log('主进程: 一键恢复所有图标');
    
    if (!databaseManager) {
      console.log('数据库未初始化，尝试重新初始化');
      
      try {
        const workspacePath = configManager.getWorkspacePath();
        if (workspacePath) {
          databaseManager = new DatabaseManager(workspacePath);
          await databaseManager.initialize();
          console.log('数据库重新初始化成功');
        } else {
          return { success: false, error: '无法获取工作目录' };
        }
      } catch (reinitError) {
        console.error('重新初始化数据库失败:', reinitError);
        return { success: false, error: '数据库初始化失败' };
      }
    }
    
    try {
      // 获取图标记录（getAllIconApplications 已经处理了路径的反规范化）
      const records = databaseManager.getAllIconApplications();
      const results = {
        total: records.length,
        success: 0,
        failed: 0,
        errors: [] as string[]
      };
      
      console.log(`共找到 ${records.length} 条图标记录`);
      
      for (const record of records) {
        try {
          // 记录恢复的文件夹路径
          console.log(`正在恢复文件夹图标: ${record.folderPath}`);
          
          // 确保使用当前用户的实际路径（folderPath 在 getAllIconApplications 中已处理）
          // 处理iconPath - 如果是相对路径，需要拼接工作目录路径
          let actualIconPath = record.iconPath;
          
          // 检查是否是相对路径
          if (!actualIconPath.startsWith('/') && !actualIconPath.match(/^[A-Za-z]:\\/)) {
            // 拼接工作目录路径
            const workspacePath = databaseManager.getWorkspacePath();
            actualIconPath = join(workspacePath, actualIconPath);
            console.log(`处理相对路径: ${record.iconPath} -> ${actualIconPath}`);
          }
          
          // 检查图标文件是否存在
          try {
            await fs.access(actualIconPath);
            console.log(`图标文件验证成功: ${actualIconPath}`);
          } catch (error) {
            console.error(`图标文件访问错误: ${actualIconPath}`);
            throw new Error(`图标文件不存在或无法访问: ${actualIconPath}`);
          }
          
          // 检查文件夹是否存在
          try {
            const stats = await fs.stat(record.folderPath);
            if (!stats.isDirectory()) {
              throw new Error('不是有效的文件夹');
            }
            console.log(`目标文件夹验证成功: ${record.folderPath}`);
          } catch (error: any) {
            if (error.code === 'ENOENT') {
              throw new Error(`文件夹不存在: ${record.folderPath}`);
            }
            throw error;
          }
          
          // 获取内部fileicon工具的路径
          const fileiconPath = getInternalFileiconPath();
          
          // 在生产环境下，可能需要临时复制fileicon到有执行权限的目录
          let execPath = fileiconPath;
          if (!is.dev) {
            const tempDir = app.getPath('temp');
            const tempFileiconPath = join(tempDir, `fileicon_restore_${Date.now()}`);
            
            try {
              await fs.copyFile(fileiconPath, tempFileiconPath);
              await fs.chmod(tempFileiconPath, 0o755);
              execPath = tempFileiconPath;
              console.log(`使用临时fileicon路径: ${execPath}`);
            } catch (copyError) {
              console.error('复制fileicon文件失败:', copyError);
              // 继续使用原路径
            }
          }
          
          // 应用图标
          console.log(`执行命令: ${execPath} set "${record.folderPath}" "${actualIconPath}"`);
          await execFileAsync(execPath, ['set', record.folderPath, actualIconPath]);
          console.log(`成功应用图标: ${record.folderPath}`);
          
          // 如果用了临时文件，尝试清理
          if (execPath !== fileiconPath) {
            fs.unlink(execPath).catch(e => console.warn('清理临时文件失败:', e));
          }
          
          // 刷新Finder缓存
          try {
            await execFileAsync('touch', [record.folderPath]);
          } catch (error) {
            // 忽略刷新缓存的错误
          }
          
          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push(`${record.folderPath}: ${error.message}`);
          console.error(`恢复图标失败 (${record.folderPath}):`, error);
        }
      }
      
      return { 
        success: true,
        results
      };
    } catch (error) {
      console.error('一键恢复图标失败:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 获取用户数据目录
  ipcMain.handle('get-user-data-path', async () => {
    const workspacePath = await configManager.getWorkspacePath();
    console.log('获取工作目录路径:', workspacePath);
    return workspacePath || app.getPath('userData');
  });
  
  // 加载用户自定义图标
  ipcMain.handle('load-custom-icons', async () => {
    console.log('主进程: 加载用户自定义图标');
    
    try {
      const customIconsDir = await getCustomIconsDirectory();
      if (!customIconsDir) {
        console.log('没有可用的自定义图标目录');
        return [];
      }
      
      console.log('自定义图标目录:', customIconsDir);
      
      // 检查目录是否存在
      if (!fsSync.existsSync(customIconsDir)) {
        console.log('自定义图标目录不存在');
        return [];
      }
      
      // 读取目录中的所有图片文件
      const files = await fs.readdir(customIconsDir);
      const imageExtensions = ['.png', '.jpg', '.jpeg', '.svg', '.gif'];
      
      const iconFiles = files
        .filter(file => {
          const ext = path.extname(file).toLowerCase();
          return imageExtensions.includes(ext);
        })
        .map(file => {
          return {
            fileName: file,
            filePath: path.join(customIconsDir, file)
          };
        });
      
      console.log(`找到 ${iconFiles.length} 个自定义图标`);
      return iconFiles;
    } catch (error) {
      console.error('加载用户自定义图标失败:', error);
      return [];
    }
  });
  
  // 复制示例图标到自定义图标目录
  ipcMain.handle('copy-example-icons', async () => {
    console.log('主进程: 复制示例图标');
    
    try {
      const customIconsDir = await getCustomIconsDirectory();
      if (!customIconsDir) {
        console.log('没有可用的自定义图标目录');
        return { success: false, error: '未设置工作目录' };
      }
      
      // 确保目录存在
      if (!fsSync.existsSync(customIconsDir)) {
        await fs.mkdir(customIconsDir, { recursive: true });
      }
      
      // 复制README文件
      const readmePath = is.dev 
        ? join(process.cwd(), 'README-source-icons.md')
        : join(app.getAppPath(), 'README-source-icons.md');
      
      if (fsSync.existsSync(readmePath)) {
        await fs.copyFile(readmePath, join(customIconsDir, 'README.md'));
        console.log('已复制README文件');
      }
      
      // 示例图标来源目录 (使用内置图标)
      const exampleSourceDir = is.dev
        ? join(process.cwd(), 'build/extra-resources/icons')
        : join(process.resourcesPath, 'extra-resources/icons');
      
      // 检查示例源目录是否存在
      if (!fsSync.existsSync(exampleSourceDir)) {
        console.log('示例图标目录不存在:', exampleSourceDir);
        return { success: false, error: '示例图标目录不存在' };
      }
      
      // 读取示例目录中的一些图标 (最多5个)
      const files = await fs.readdir(exampleSourceDir);
      const imageFiles = files.filter(file => {
        return path.extname(file).toLowerCase() === '.png';
      }).slice(0, 5); // 只复制前5个示例
      
      // 复制示例图标
      for (const file of imageFiles) {
        const sourcePath = join(exampleSourceDir, file);
        const targetPath = join(customIconsDir, `example-${file}`);
        
        if (fsSync.existsSync(sourcePath) && !fsSync.existsSync(targetPath)) {
          await fs.copyFile(sourcePath, targetPath);
          console.log(`已复制示例图标: ${file} -> example-${file}`);
        }
      }
      
      return { success: true, count: imageFiles.length };
    } catch (error) {
      console.error('复制示例图标失败:', error);
      return { success: false, error: (error as Error).message };
    }
  });
  
  // 打开自定义图标目录
  ipcMain.handle('open-custom-icons-directory', async () => {
    console.log('主进程: 打开自定义图标目录');
    
    try {
      const customIconsDir = await getCustomIconsDirectory();
      if (!customIconsDir || !fsSync.existsSync(customIconsDir)) {
        return { success: false, error: '自定义图标目录不存在' };
      }
      
      // 使用系统资源管理器/访达打开目录
      shell.openPath(customIconsDir);
      return { success: true };
    } catch (error) {
      console.error('打开自定义图标目录失败:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 设置注册标志
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
  // 设置应用图标 (Linux专用)
  if (process.platform === 'linux') {
    // 使用兼容的方式设置图标
    if (BrowserWindow.getAllWindows().length > 0) {
      BrowserWindow.getAllWindows().forEach(window => window.setIcon(icon));
    }
  }
  
  // 初始化配置管理器
  try {
    await configManager.loadConfig();
    const { workspacePath } = configManager.getConfig();
    
    console.log('从配置文件中获取的工作目录:', workspacePath);
    
    // 确保有工作目录
    if (!workspacePath) {
      // 设置默认工作目录 (用户文档中的子目录)
      const defaultWorkspacePath = join(app.getPath('documents'), 'themes/Mac-Folder-Icon');
      // 确保目录存在
      await fs.mkdir(defaultWorkspacePath, { recursive: true });
      
      // 更新配置
      await configManager.updateWorkspacePath(defaultWorkspacePath);
      console.log('已设置默认工作目录:', defaultWorkspacePath);
    }
    
    // 再次获取工作目录（可能已经更新为默认值）
    const finalWorkspacePath = configManager.getWorkspacePath();
    console.log('最终使用的工作目录:', finalWorkspacePath);
    
    // 确保工作目录存在
    try {
      await fs.mkdir(finalWorkspacePath, { recursive: true });
      console.log('确保工作目录存在:', finalWorkspacePath);
    } catch (mkdirError) {
      console.error('创建工作目录失败:', mkdirError);
      throw mkdirError;
    }
    
    // 确保应用图标目录存在
    try {
      const appliedIconsPath = join(finalWorkspacePath, 'applied-icons');
      await fs.mkdir(appliedIconsPath, { recursive: true });
      console.log('确保应用图标目录存在:', appliedIconsPath);
    } catch (mkdirError) {
      console.error('创建应用图标目录失败:', mkdirError);
      throw mkdirError;
    }
    
    // 检查数据库文件权限和可访问性
    const dbPath = join(finalWorkspacePath, 'icon-manager-db.json');
    try {
      // 尝试创建数据库文件（如果不存在）
      if (!fsSync.existsSync(dbPath)) {
        const initialData = JSON.stringify({
          iconApplications: {},
          lastId: 0
        }, null, 2);
        await fs.writeFile(dbPath, initialData, 'utf-8');
        console.log('创建初始数据库文件:', dbPath);
      } else {
        // 检查文件是否可读写
        await fs.access(dbPath, fs.constants.R_OK | fs.constants.W_OK);
        console.log('数据库文件权限检查通过:', dbPath);
      }
    } catch (fileError) {
      console.error('数据库文件访问错误:', fileError);
      throw fileError;
    }
    
    // 初始化数据库管理器
    databaseManager = new DatabaseManager(finalWorkspacePath);
    await databaseManager.initialize();
    
    console.log('工作目录和数据库初始化成功:', finalWorkspacePath);
  } catch (error) {
    console.error('初始化配置或数据库失败:', error);
    
    // 尝试使用默认路径恢复
    try {
      const defaultWorkspacePath = join(app.getPath('documents'), 'themes/Mac-Folder-Icon');
      console.log('尝试使用默认工作目录初始化:', defaultWorkspacePath);
      
      // 确保目录存在
      await fs.mkdir(defaultWorkspacePath, { recursive: true });
      
      // 确保应用图标目录存在
      const appliedIconsPath = join(defaultWorkspacePath, 'applied-icons');
      await fs.mkdir(appliedIconsPath, { recursive: true });
      
      // 创建默认数据库文件
      const dbPath = join(defaultWorkspacePath, 'icon-manager-db.json');
      if (!fsSync.existsSync(dbPath)) {
        const initialData = JSON.stringify({
          iconApplications: {},
          lastId: 0
        }, null, 2);
        await fs.writeFile(dbPath, initialData, 'utf-8');
      }
      
      // 初始化数据库管理器
      databaseManager = new DatabaseManager(defaultWorkspacePath);
      await databaseManager.initialize();
      
      // 更新配置
      await configManager.updateWorkspacePath(defaultWorkspacePath);
      
      console.log('使用默认工作目录初始化成功');
    } catch (fallbackError) {
      console.error('使用默认工作目录初始化失败:', fallbackError);
    }
  }
  
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

  // 在应用即将退出时关闭数据库连接
  app.on('will-quit', () => {
    if (databaseManager) {
      databaseManager.close();
    }
  });

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
  ipcMain.removeHandler('reset-icon');
  ipcMain.removeHandler('get-workspace');
  ipcMain.removeHandler('get-applied-icons');
  ipcMain.removeHandler('get-user-data-path');
  ipcMain.removeHandler('load-custom-icons');
  ipcMain.removeHandler('copy-example-icons');
  ipcMain.removeHandler('open-custom-icons-directory');
  
  // 重置IPC处理程序注册标志
  ipcHandlersRegistered = false;
  
  console.log('资源清理完成');
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
