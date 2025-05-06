/**
 * 文件夹图标管理器
 * 用于处理文件夹操作和应用图标
 */

// 检查API是否可用
const isApiAvailable = (): boolean => {
  return !!window.api;
};

/**
 * 应用图标到文件夹
 * @param folderPath 文件夹路径
 * @param iconPath 图标路径
 * @returns Promise 操作结果
 */
export const applyIconToFolder = async (folderPath: string, iconPath: string): Promise<void> => {
  if (!isApiAvailable()) {
    console.error('API不可用，可能在Web预览模式下运行');
    throw new Error('API不可用，无法应用图标');
  }

  try {
    // 清理路径以防有FS路径前缀
    const cleanedPath = iconPath.replace('/@fs', '');
    return window.api.applyIconToFolder(folderPath, cleanedPath);
  } catch (error) {
    console.error('应用图标失败:', error);
    throw error;
  }
};

/**
 * 检查路径是否为文件夹
 * @param path 路径
 * @returns Promise 检查结果
 */
export const checkPath = async (path: string): Promise<{exists: boolean, isDirectory: boolean, path: string}> => {
  if (!isApiAvailable()) {
    console.error('API不可用，可能在Web预览模式下运行');
    return { exists: false, isDirectory: false, path };
  }
  return window.api.checkPath(path);
};

/**
 * 打开选择文件夹对话框
 * @returns Promise 选择的文件夹路径，取消则返回null
 */
export const selectFolder = async (): Promise<string | null> => {
  if (!isApiAvailable()) {
    console.error('API不可用，可能在Web预览模式下运行');
    return null;
  }
  return window.api.selectFolder();
};

/**
 * 处理文件夹拖拽事件
 * @param event 拖拽事件
 * @returns Promise 文件夹路径，如果不是文件夹则返回null
 */
export const handleFolderDrop = async (event: DragEvent): Promise<string | null> => {
  if (!isApiAvailable()) {
    console.error('API不可用，可能在Web预览模式下运行');
    return null;
  }

  // 获取拖拽路径
  const path = window.api.getDraggedFolderPath(event);
  
  if (!path) {
    return null;
  }
  
  // 验证是否为文件夹
  const pathInfo = await checkPath(path);
  if (pathInfo.exists && pathInfo.isDirectory) {
    return path;
  }
  
  return null;
}; 