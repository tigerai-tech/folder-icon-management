"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
const api = {
  // 新增IPC通道
  applyIconToFolder: (folderPath, iconPath) => {
    return electron.ipcRenderer.invoke("apply-icon", { folderPath, iconPath });
  },
  // 增加解析拖拽文件的方法
  getDraggedFolderPath: (event) => {
    console.log("preload: getDraggedFolderPath 被调用");
    if (!event) {
      console.log("preload: 事件对象为空");
      return null;
    }
    if (!event.dataTransfer) {
      console.log("preload: 事件中无dataTransfer对象");
      return null;
    }
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      console.log("preload: 拖拽的文件数量:", event.dataTransfer.files.length);
      const file = event.dataTransfer.files[0];
      console.log("preload: 拖拽的第一个文件类型:", file.type);
      const path = file.path;
      console.log("preload: 解析到的路径:", path);
      return path;
    }
    console.log("preload: 未找到有效文件");
    return null;
  },
  // 检查路径是否为文件夹
  checkPath: async (path) => {
    console.log("preload: 检查路径:", path);
    return electron.ipcRenderer.invoke("check-path", path);
  },
  // 打开选择文件夹对话框
  selectFolder: async () => {
    console.log("preload: 打开选择文件夹对话框");
    return electron.ipcRenderer.invoke("select-folder");
  }
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = preload.electronAPI;
  window.api = api;
}
