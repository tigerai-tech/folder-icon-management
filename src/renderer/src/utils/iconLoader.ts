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
  
  // 使用Vite的import.meta.glob动态导入所有图标
  const iconModules = import.meta.glob('/resources/icons/*.png', { eager: true });
  
  // 处理每个导入的图标
  Object.entries(iconModules).forEach(([path, module]) => {
    // 从路径中提取文件名
    const fileName = path.split('/').pop() || '';
    // 移除文件扩展名
    const name = fileName.replace(/\.[^.]+$/, '');
    
    // 添加到图标列表
    icons.push({
      // 从文件名中提取一个更友好的显示名称 (例如: folder13~iphone -> Folder 13)
      name: name.replace(/folder(\d+)~iphone/i, 'Folder $1').replace(/^./, (c) => c.toUpperCase()),
      // @ts-ignore - 模块类型
      path: module.default
    });
  });
  
  return icons;
};

// 默认内置的SVG图标
const defaultSvgIcons: IconItem[] = [
  { 
    name: '红色', 
    path: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0Ij4KICA8cGF0aCBmaWxsPSIjZjU2NTY1IiBkPSJNMTAgNEg0Yy0xLjEgMC0xLjk5LjktMS45OSAyTDIgMThjMCAxLjEuOSAyIDIgMmgxNmMxLjEgMCAyLS45IDItMlY4YzAtMS4xLS45LTItMi0yaC04bC0yLTJ6Ii8+Cjwvc3ZnPg==' 
  },
  { 
    name: '绿色', 
    path: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0Ij4KICA8cGF0aCBmaWxsPSIjNDhhZTY1IiBkPSJNMTAgNEg0Yy0xLjEgMC0xLjk5LjktMS45OSAyTDIgMThjMCAxLjEuOSAyIDIgMmgxNmMxLjEgMCAyLS45IDItMlY4YzAtMS4xLS45LTItMi0yaC04bC0yLTJ6Ii8+Cjwvc3ZnPg==' 
  },
  { 
    name: '黄色', 
    path: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0Ij4KICA8cGF0aCBmaWxsPSIjZWNjOTRiIiBkPSJNMTAgNEg0Yy0xLjEgMC0xLjk5LjktMS45OSAyTDIgMThjMCAxLjEuOSAyIDIgMmgxNmMxLjEgMCAyLS45IDItMlY4YzAtMS4xLS45LTItMi0yaC04bC0yLTJ6Ii8+Cjwvc3ZnPg==' 
  },
  { 
    name: '紫色', 
    path: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0Ij4KICA8cGF0aCBmaWxsPSIjODA1YWQ1IiBkPSJNMTAgNEg0Yy0xLjEgMC0xLjk5LjktMS45OSAyTDIgMThjMCAxLjEuOSAyIDIgMmgxNmMxLjEgMCAyLS45IDItMlY4YzAtMS4xLS45LTItMi0yaC04bC0yLTJ6Ii8+Cjwvc3ZnPg==' 
  }
];

/**
 * 获取所有可用图标
 * @returns 包含所有内置图标和SVG图标的数组
 */
export const getAllIcons = (): IconItem[] => {
  return [...loadBuiltinIcons(), ...defaultSvgIcons];
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