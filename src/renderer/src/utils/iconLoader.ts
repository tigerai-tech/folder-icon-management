/**
 * 图标加载器工具
 * 用于动态加载icons目录下的所有图标
 */

interface IconItem {
  name: string;
  path: string;
  keywords: string[]; // 关键词列表，用于搜索
  originalFileName: string; // 原始文件名，不含扩展名
}

// 从文件名提取关键词
const extractKeywords = (fileName: string): string[] => {
  // 移除文件扩展名
  const nameWithoutExt = fileName.replace(/\.[^.]+$/, '');
  const keywords: string[] = [];
  
  // 添加原始文件名作为关键词
  keywords.push(nameWithoutExt.toLowerCase());
  
  // 提取数字 (例如folder14~iphone中的14)
  const numberMatch = nameWithoutExt.match(/(\d+)/g);
  if (numberMatch) {
    numberMatch.forEach(num => keywords.push(num));
  }
  
  // 分离特殊符号，提取单词
  const words = nameWithoutExt
    .replace(/[\~\-\_]/g, ' ')
    .split(' ')
    .filter(word => word.length > 0);
  
  words.forEach(word => {
    // 添加单词作为关键词
    keywords.push(word.toLowerCase());
    
    // 特殊处理：文件夹图标
    if (word.toLowerCase().includes('folder')) {
      keywords.push('folder');
      keywords.push('文件夹');
    }
    
    // 特殊处理：书籍图标
    if (word.toLowerCase().includes('book')) {
      keywords.push('book');
      keywords.push('书');
      keywords.push('书籍');
    }
    
    // 其他常见图标类型特殊处理
    const iconTypeMap: Record<string, string[]> = {
      'audio': ['音频', '声音'],
      'video': ['视频', '影片'],
      'document': ['文档', '文件'],
      'music': ['音乐', '曲目'],
      'photo': ['照片', '图片', 'image'],
      'movie': ['电影', '影片', 'film'],
      'iphone': ['手机', 'phone', '苹果'],
      'mac': ['苹果', 'apple', '电脑']
    };
    
    // 添加本地化关键词
    Object.entries(iconTypeMap).forEach(([key, translations]) => {
      if (word.toLowerCase().includes(key)) {
        keywords.push(key);
        translations.forEach(trans => keywords.push(trans));
      }
    });
  });
  
  // 去重
  return [...new Set(keywords)];
};

// 格式化显示名称
const formatDisplayName = (fileName: string): string => {
  // 移除文件扩展名
  const nameWithoutExt = fileName.replace(/\.[^.]+$/, '');
  
  // 特殊处理folder格式
  let displayName = nameWithoutExt.replace(/folder(\d+)~iphone/i, 'Folder $1');
  
  // 将连字符和下划线替换为空格
  displayName = displayName.replace(/[-_~]/g, ' ');
  
  // 首字母大写
  displayName = displayName.replace(/^./, (c) => c.toUpperCase());
  
  // 将多个空格替换为单个空格并修剪
  return displayName.replace(/\s+/g, ' ').trim();
};

// 获取所有的内置图标
const loadBuiltinIcons = (): IconItem[] => {
  const icons: IconItem[] = [];
  
  try {
    // 使用Vite的import.meta.glob动态导入所有图标
    // 注意: 在Vite中，资源路径应该相对于项目根目录或使用别名
    const iconModules = import.meta.glob('../../../../build/extra-resources/icons/*.png', { eager: true });
    console.log('找到图标模块:', Object.keys(iconModules).length);
    
    // 输出前几个图标路径做调试
    if (Object.keys(iconModules).length > 0) {
      const firstFewKeys = Object.keys(iconModules).slice(0, 3);
      console.log('图标路径示例:', firstFewKeys);
      
      // 检查路径格式
      firstFewKeys.forEach(key => {
        // @ts-ignore - 模块类型
        console.log('图标实际路径:', (iconModules[key] as any).default);
      });
    }
    
    // 处理每个导入的图标
    Object.entries(iconModules).forEach(([path, module]) => {
      // 从路径中提取文件名
      const fileName = path.split('/').pop() || '';
      // 移除文件扩展名
      const nameWithoutExt = fileName.replace(/\.[^.]+$/, '');
      
      // 提取关键词
      const keywords = extractKeywords(fileName);
      
      // 格式化显示名称
      const displayName = formatDisplayName(fileName);
      
      // @ts-ignore - 模块类型
      const imagePath = (module as any).default;
      console.log(`加载图标: ${displayName}, 文件名: ${fileName}, 路径: ${imagePath}`);
      
      // 添加到图标列表
      icons.push({
        name: displayName,
        // @ts-ignore - 模块类型
        path: imagePath,
        keywords: keywords,
        originalFileName: nameWithoutExt
      });
    });
    
    console.log('成功加载内置图标数量:', icons.length);
    
    // 调试：显示一些图标路径
    if (icons.length > 0) {
      console.log('第一个图标信息:', {
        name: icons[0].name,
        path: icons[0].path,
        originalFileName: icons[0].originalFileName
      });
    }
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

/**
 * 根据关键词搜索图标
 * @param keyword 搜索关键词
 * @returns 匹配的图标数组
 */
export const searchIcons = (keyword: string): IconItem[] => {
  if (!keyword) {
    return getAllIcons();
  }
  
  const allIcons = getAllIcons();
  const searchTerms = keyword.toLowerCase().split(/\s+/);
  
  return allIcons.filter(icon => {
    // 检查每个搜索词是否匹配任何关键词
    return searchTerms.some(term => 
      icon.keywords.some(keyword => keyword.includes(term)) ||
      icon.name.toLowerCase().includes(term) ||
      icon.originalFileName.toLowerCase().includes(term)
    );
  });
};

export type { IconItem }; 