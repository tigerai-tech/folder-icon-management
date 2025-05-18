import { app } from 'electron';
import { join } from 'path';
import { promises as fs } from 'fs';
import os from 'os';

interface AppConfig {
  workspacePath: string;
}

class ConfigManager {
  private configPath: string;
  private config: AppConfig;

  constructor() {
    // 配置文件存储在用户数据目录
    this.configPath = join(app.getPath('userData'), 'config.json');
    
    // 默认配置
    this.config = {
      workspacePath: join(os.homedir(), 'Documents', 'themes/Mac-Folder-Icon')
    };
  }

  /**
   * 加载配置
   */
  async loadConfig(): Promise<AppConfig> {
    try {
      // 检查配置文件是否存在
      await fs.access(this.configPath);

      // 读取配置文件
      const configData = await fs.readFile(this.configPath, 'utf-8');
      const loadedConfig = JSON.parse(configData);
      
      // 合并配置，确保所有必要的字段都存在
      this.config = {
        ...this.config,
        ...loadedConfig
      };
      
      console.log('配置已加载:', this.config);
    } catch (error) {
      // 如果配置文件不存在或无法读取，使用默认配置
      console.log('使用默认配置:', this.config);
      
      // 保存默认配置
      await this.saveConfig();
    }

    return this.config;
  }

  /**
   * 保存配置
   */
  async saveConfig(): Promise<void> {
    try {
      // 确保目录存在
      const configDir = join(app.getPath('userData'));
      try {
        await fs.access(configDir);
      } catch (error) {
        await fs.mkdir(configDir, { recursive: true });
      }

      // 写入配置文件
      await fs.writeFile(
        this.configPath, 
        JSON.stringify(this.config, null, 2), 
        'utf-8'
      );
      
      console.log('配置已保存:', this.config);
    } catch (error) {
      console.error('保存配置失败:', error);
      throw error;
    }
  }

  /**
   * 更新工作目录路径
   */
  async updateWorkspacePath(path: string): Promise<void> {
    this.config.workspacePath = path;
    await this.saveConfig();
  }

  /**
   * 获取当前工作目录路径
   */
  getWorkspacePath(): string {
    return this.config.workspacePath;
  }

  /**
   * 获取完整配置
   */
  getConfig(): AppConfig {
    return { ...this.config };
  }
}

export default ConfigManager;
export type { AppConfig }; 