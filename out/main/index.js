"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const fs = require("fs");
const child_process = require("child_process");
const util = require("util");
const icon = path.join(__dirname, "../../resources/icon.png");
const execFileAsync = util.promisify(child_process.execFile);
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...process.platform === "linux" ? { icon } : {},
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      nodeIntegration: true,
      contextIsolation: true,
      webSecurity: false
      // 允许加载本地资源
    }
  });
  mainWindow.webContents.openDevTools();
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
    console.log("主窗口已显示");
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  setupIpcHandlers(mainWindow);
}
function setupIpcHandlers(mainWindow) {
  electron.ipcMain.handle("select-folder", async () => {
    console.log("主进程: 打开选择文件夹对话框");
    const result = await electron.dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const folderPath = result.filePaths[0];
      console.log("主进程: 用户选择了文件夹:", folderPath);
      return folderPath;
    }
    console.log("主进程: 用户取消了选择");
    return null;
  });
  electron.ipcMain.handle("check-path", async (_, path2) => {
    console.log("主进程: 检查路径:", path2);
    try {
      const stats = await fs.promises.stat(path2);
      const isDirectory = stats.isDirectory();
      console.log("主进程: 路径是否为文件夹:", isDirectory);
      return {
        exists: true,
        isDirectory,
        path: path2
      };
    } catch (error) {
      console.log("主进程: 检查路径失败:", error);
      return {
        exists: false,
        isDirectory: false,
        path: path2
      };
    }
  });
  electron.ipcMain.handle("apply-icon", async (_, args) => {
    try {
      const { folderPath, iconPath } = args;
      if (!folderPath || !iconPath) {
        throw new Error("无效的文件夹或图标路径");
      }
      try {
        const stats = await fs.promises.stat(folderPath);
        if (!stats.isDirectory()) {
          throw new Error("所选路径不是有效的文件夹");
        }
        console.log(`正在处理文件夹: ${folderPath}`);
      } catch (error) {
        console.error(`检查文件夹错误: ${error.message}`);
        if (error.code === "ENOENT") {
          throw new Error(`找不到文件夹: ${folderPath}`);
        }
        throw error;
      }
      let finalIconPath = iconPath;
      if (iconPath.startsWith("data:") || iconPath.startsWith("blob:")) {
        try {
          const tempDir = electron.app.getPath("temp");
          const randomName = `icon_${Date.now()}.png`;
          finalIconPath = path.join(tempDir, randomName);
          const base64Data = iconPath.split(",")[1];
          if (base64Data) {
            await fs.promises.writeFile(finalIconPath, Buffer.from(base64Data, "base64"));
          } else {
            throw new Error("无效的图标数据格式");
          }
        } catch (error) {
          console.error("创建临时图标文件失败:", error);
          if (error.code === "EACCES") {
            throw new Error("没有足够的权限创建临时文件，请尝试以管理员身份运行应用");
          }
          throw error;
        }
      }
      try {
        await execFileAsync("fileicon", ["set", folderPath, finalIconPath]);
        await execFileAsync("touch", [folderPath]);
        mainWindow.webContents.send("icon-applied");
        return { success: true };
      } catch (error) {
        console.error("设置图标失败:", error);
        if (error.code === "ENOENT") {
          throw new Error("找不到fileicon命令。请使用 sudo npm install -g fileicon 安装");
        } else if (error.code === "EACCES") {
          throw new Error("没有足够的权限修改文件夹图标，请尝试以管理员身份运行应用");
        }
        throw error;
      }
    } catch (error) {
      console.error("应用图标失败:", error);
      mainWindow.webContents.send("icon-apply-error", error.message);
      throw error;
    }
  });
}
electron.app.whenReady().then(() => {
  utils.electronApp.setAppUserModelId("com.electron");
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  createWindow();
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
