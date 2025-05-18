import { join } from 'path';
import { promises as fs } from 'fs';

// 图标应用信息表结构
interface IconApplicationInfo {
  id?: number;
  folderPath: string;        // 文件夹路径（唯一键）
  sourceIconName: string;    // 源图标名称
  isBuiltIn: boolean;        // 是否是内置图标
  iconPath: string;          // 应用的图标路径（在工作目录中）
  originalIconPath?: string; // 原始图标路径
  appliedAt: string;         // 应用时间（ISO字符串）
}

// 存储结构
interface StoreData {
  iconApplications: Record<string, IconApplicationInfo>;  // 使用文件夹路径作为键
  lastId: number;
}

// 用于跨用户路径处理的用户名占位符
const USER_PLACEHOLDER = '{USER}';

// 规范化路径，替换用户名为占位符
function normalizePath(path: string): string {
  const homeDir = require('os').homedir();
  const username = homeDir.split('/').slice(-1)[0];
  
  // 替换用户路径，例如 /Users/username/ 变为 /Users/{USER}/
  if (path.includes(`/Users/${username}/`)) {
    return path.replace(`/Users/${username}/`, `/Users/${USER_PLACEHOLDER}/`);
  }
  return path;
}

// 反规范化路径，替换占位符为当前用户名
function denormalizePath(path: string): string {
  if (!path.includes(USER_PLACEHOLDER)) {
    return path;
  }
  
  const homeDir = require('os').homedir();
  const username = homeDir.split('/').slice(-1)[0];
  
  return path.replace(`/Users/${USER_PLACEHOLDER}/`, `/Users/${username}/`);
}

class DatabaseManager {
  private storeData: StoreData;
  private workspacePath: string;
  private appliedIconsPath: string;
  private dbPath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
    this.appliedIconsPath = join(workspacePath, 'applied-icons');
    this.dbPath = join(workspacePath, 'icon-manager-db.json');
    
    // 初始化存储数据
    this.storeData = {
      iconApplications: {},
      lastId: 0
    };
  }

  /**
   * 初始化数据库和工作目录
   */
  async initialize(): Promise<void> {
    try {
      // 确保工作目录存在
      await this.ensureDirectoryExists(this.workspacePath);
      
      // 确保应用图标目录存在
      await this.ensureDirectoryExists(this.appliedIconsPath);
      
      // 加载数据库文件（如果存在）
      await this.loadStore();
      
      console.log('数据库初始化成功');
    } catch (error) {
      console.error('数据库初始化失败:', error);
      throw error;
    }
  }

  /**
   * 确保目录存在，如果不存在则创建
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch (error) {
      // 目录不存在，创建它
      await fs.mkdir(dirPath, { recursive: true });
      console.log(`创建目录: ${dirPath}`);
    }
  }

  /**
   * 加载存储数据
   */
  private async loadStore(): Promise<void> {
    try {
      // 检查文件是否存在
      try {
        await fs.access(this.dbPath);
        
        // 读取并解析JSON文件
        const data = await fs.readFile(this.dbPath, 'utf-8');
        this.storeData = JSON.parse(data) as StoreData;
        console.log('加载数据库文件成功');
      } catch (error) {
        // 文件不存在或无法读取，使用默认值
        console.log('使用默认数据（数据库文件不存在或无法读取）');
        this.storeData = {
          iconApplications: {},
          lastId: 0
        };
        
        // 立即保存默认数据到文件
        await this.saveStore();
      }
    } catch (error) {
      console.error('加载存储数据失败:', error);
      throw error;
    }
  }

  /**
   * 保存存储数据
   */
  private async saveStore(): Promise<void> {
    try {
      // 将数据转换为JSON字符串并写入文件
      const data = JSON.stringify(this.storeData, null, 2);
      await fs.writeFile(this.dbPath, data, 'utf-8');
      console.log('保存数据库文件成功');
    } catch (error) {
      console.error('保存存储数据失败:', error);
      throw error;
    }
  }

  /**
   * 记录图标应用信息
   */
  async recordIconApplication(info: Omit<IconApplicationInfo, 'id'>): Promise<void> {
    try {
      // 规范化所有包含用户名的路径
      const normalizedFolderPath = normalizePath(info.folderPath);
      const normalizedIconPath = normalizePath(info.iconPath);
      const normalizedOriginalIconPath = info.originalIconPath ? normalizePath(info.originalIconPath) : undefined;
      
      console.log(`路径规范化: ${info.folderPath} -> ${normalizedFolderPath}`);
      console.log(`图标路径规范化: ${info.iconPath} -> ${normalizedIconPath}`);
      if (info.originalIconPath) {
        console.log(`原始图标路径规范化: ${info.originalIconPath} -> ${normalizedOriginalIconPath}`);
      }
      
      // 创建新记录，确保时间是字符串
      const newRecord: IconApplicationInfo = {
        ...info,
        folderPath: normalizedFolderPath, // 使用规范化的路径
        iconPath: normalizedIconPath, // 规范化的图标路径
        originalIconPath: normalizedOriginalIconPath, // 规范化的原始图标路径
        id: ++this.storeData.lastId,
        // 确保appliedAt是字符串格式
        appliedAt: typeof info.appliedAt === 'string' 
          ? info.appliedAt 
          : (info.appliedAt as unknown as Date).toISOString()
      };
      
      // 更新存储
      this.storeData.iconApplications[normalizedFolderPath] = newRecord;
      
      // 保存到文件
      await this.saveStore();
      
      console.log(`记录图标应用: ${normalizedFolderPath}`);
    } catch (error) {
      console.error('记录图标应用失败:', error);
      throw error;
    }
  }

  /**
   * 删除图标应用记录
   */
  async removeIconApplication(folderPath: string): Promise<void> {
    try {
      // 规范化路径
      const normalizedFolderPath = normalizePath(folderPath);
      
      // 首先获取记录，以便找到对应的图标文件
      const record = this.getIconApplicationByFolder(normalizedFolderPath);
      
      if (record) {
        // 删除记录
        delete this.storeData.iconApplications[normalizedFolderPath];
        
        // 保存到文件
        await this.saveStore();
        
        // 尝试删除对应的图标文件
        try {
          if (record.iconPath) {
            let fullIconPath = '';
            
            // 如果是相对路径，用工作目录拼接完整路径
            if (!record.iconPath.startsWith('/') && !record.iconPath.match(/^[A-Za-z]:\\/)) {
              fullIconPath = join(this.workspacePath, record.iconPath);
            } else {
              // 如果是绝对路径（旧数据格式），直接使用
              fullIconPath = denormalizePath(record.iconPath);
            }
            
            // 确保路径存在
            if (await this.fileExists(fullIconPath)) {
              await fs.unlink(fullIconPath);
              console.log(`删除图标文件: ${fullIconPath}`);
            } else {
              console.warn(`图标文件不存在，无法删除: ${fullIconPath}`);
            }
          }
        } catch (fileError) {
          console.warn(`无法删除图标文件: ${record.iconPath}`, fileError);
          // 不让文件删除失败影响整个操作
        }
        
        console.log(`删除图标应用记录: ${normalizedFolderPath}`);
      } else {
        // 如果找不到规范化的路径，尝试直接查找
        const directRecord = this.storeData.iconApplications[folderPath];
        if (directRecord) {
          delete this.storeData.iconApplications[folderPath];
          await this.saveStore();
          console.log(`删除未规范化的图标应用记录: ${folderPath}`);
        } else {
          console.log(`未找到图标应用记录: ${normalizedFolderPath}`);
        }
      }
    } catch (error) {
      console.error('删除图标应用记录失败:', error);
      throw error;
    }
  }

  /**
   * 获取文件夹的图标应用记录
   */
  getIconApplicationByFolder(folderPath: string): IconApplicationInfo | null {
    try {
      // 规范化路径
      const normalizedFolderPath = normalizePath(folderPath);
      
      // 尝试用规范化路径查找
      const record = this.storeData.iconApplications[normalizedFolderPath];
      if (record) {
        return record;
      }
      
      // 如果找不到，尝试直接查找（兼容旧数据）
      return this.storeData.iconApplications[folderPath] || null;
    } catch (error) {
      console.error('获取图标应用记录失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有图标应用记录
   */
  getAllIconApplications(): IconApplicationInfo[] {
    try {
      // 转换为数组并按应用时间排序（从新到旧）
      const records = Object.values(this.storeData.iconApplications);
      
      // 处理路径转换，替换占位符为当前用户名
      const processedRecords = records.map(record => {
        // 创建记录副本，避免修改原始数据
        const processedRecord = { ...record };
        
        // 处理文件夹路径
        if (record.folderPath.includes(USER_PLACEHOLDER)) {
          processedRecord.folderPath = denormalizePath(record.folderPath);
          console.log(`文件夹路径反规范化: ${record.folderPath} -> ${processedRecord.folderPath}`);
        }
        
        // 处理图标路径
        if (record.iconPath) {
          if (record.iconPath.includes(USER_PLACEHOLDER)) {
            // 对于绝对路径，进行用户名替换
            processedRecord.iconPath = denormalizePath(record.iconPath);
            console.log(`图标路径反规范化: ${record.iconPath} -> ${processedRecord.iconPath}`);
          } else if (!record.iconPath.startsWith('/') && !record.iconPath.match(/^[A-Za-z]:\\/)) {
            // 对于相对路径，确保它保持不变
            processedRecord.iconPath = record.iconPath;
            console.log(`保持相对图标路径: ${record.iconPath}`);
          }
        }
        
        // 处理原始图标路径
        if (record.originalIconPath && record.originalIconPath.includes(USER_PLACEHOLDER)) {
          processedRecord.originalIconPath = denormalizePath(record.originalIconPath);
          console.log(`原始图标路径反规范化: ${record.originalIconPath} -> ${processedRecord.originalIconPath}`);
        }
        
        return processedRecord;
      });
      
      // 按应用时间排序（从新到旧）
      return processedRecords.sort((a, b) => {
        return new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime();
      });
    } catch (error) {
      console.error('获取所有图标应用记录失败:', error);
      throw error;
    }
  }

  /**
   * 复制图标到应用图标目录
   */
  async copyIconToAppliedDirectory(sourceIconPath: string, iconName: string): Promise<string> {
    const timestamp = Date.now();
    const extension = sourceIconPath.split('.').pop() || 'png';
    const fileName = `${iconName.replace(/[^a-zA-Z0-9-_]/g, '_')}-${timestamp}.${extension}`;
    
    // 生成相对路径和绝对路径
    const relativeIconPath = `applied-icons/${fileName}`;
    const absoluteDestPath = join(this.appliedIconsPath, fileName);
    
    try {
      // 处理可能包含占位符的源路径
      const actualSourcePath = sourceIconPath.includes(USER_PLACEHOLDER) 
        ? denormalizePath(sourceIconPath) 
        : sourceIconPath;
      
      // 确保目标目录存在
      await this.ensureDirectoryExists(this.appliedIconsPath);
      
      // 复制文件
      try {
        const iconData = await fs.readFile(actualSourcePath);
        await fs.writeFile(absoluteDestPath, iconData);
        
        console.log(`复制图标: ${actualSourcePath} -> ${absoluteDestPath}`);
      } catch (readError) {
        console.error(`读取源图标失败(${actualSourcePath}):`, readError);
        
        // 尝试使用系统自带的默认图标作为备选
        console.log('尝试使用系统默认图标作为备选');
        const defaultIconPath = process.platform === 'darwin'
          ? '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/GenericDocumentIcon.icns'
          : '';
          
        if (defaultIconPath && await this.fileExists(defaultIconPath)) {
          const iconData = await fs.readFile(defaultIconPath);
          await fs.writeFile(absoluteDestPath, iconData);
          console.log(`使用系统默认图标: ${defaultIconPath} -> ${absoluteDestPath}`);
        } else {
          throw readError; // 如果没有默认图标可用，重新抛出错误
        }
      }
      
      // 只返回相对路径，不包含工作区路径前缀
      return relativeIconPath;
    } catch (error) {
      console.error('复制图标失败:', error);
      throw error;
    }
  }
  
  // 检查文件是否存在
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    // 无需特别关闭，文件操作都是异步的
    console.log('数据库连接已关闭');
  }

  /**
   * 获取工作目录路径
   */
  getWorkspacePath(): string {
    return this.workspacePath;
  }

  /**
   * 获取应用图标目录路径
   */
  getAppliedIconsPath(): string {
    return this.appliedIconsPath;
  }
}

export default DatabaseManager;
export type { IconApplicationInfo };
export { normalizePath, denormalizePath, USER_PLACEHOLDER };