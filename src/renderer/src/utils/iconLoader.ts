/**
 * 图标加载器工具
 * 用于动态加载icons目录下的所有图标
 */

interface IconItem {
  name: string;
  path: string;
}

// 获取所有的内置图标
const loadBuiltinIcons = (): IconItem[] => {
  const icons: IconItem[] = [];
  
  try {
    // 使用Vite的import.meta.glob动态导入所有图标
    // 注意: 在Vite中，资源路径应该相对于项目根目录或使用别名
    const iconModules = import.meta.glob('../../../../resources/icons/*.png', { eager: true });
    console.log('找到图标模块:', Object.keys(iconModules).length);
    
    // 处理每个导入的图标
    Object.entries(iconModules).forEach(([path, module]) => {
      // 从路径中提取文件名
      const fileName = path.split('/').pop() || '';
      // 移除文件扩展名
      const name = fileName.replace(/\.[^.]+$/, '');
      
      console.log('加载图标:', name, path);
      
      // 添加到图标列表
      icons.push({
        // 从文件名中提取一个更友好的显示名称 (例如: folder13~iphone -> Folder 13)
        name: name.replace(/folder(\d+)~iphone/i, 'Folder $1').replace(/^./, (c) => c.toUpperCase()),
        // @ts-ignore - 模块类型
        path: (module as any).default
      });
    });
    
    console.log('成功加载内置图标数量:', icons.length);
  } catch (error) {
    console.error('加载内置图标失败:', error);
  }
  
  return icons;
};

/**
 * 获取所有可用图标
 * @returns 包含所有内置图标和SVG图标的数组
 */
export const getAllIcons = (): IconItem[] => {
  const builtInIcons = loadBuiltinIcons();
  console.log(`获取图标: 内置图标 ${builtInIcons.length}个`);
  return [...builtInIcons];
};

/**
 * 根据名称获取图标
 * @param name 图标名称
 * @returns 图标信息，如果未找到则返回undefined
 */
export const getIconByName = (name: string): IconItem | undefined => {
  const allIcons = getAllIcons();
  return allIcons.find(icon => icon.name.toLowerCase() === name.toLowerCase());
};

export type { IconItem }; 