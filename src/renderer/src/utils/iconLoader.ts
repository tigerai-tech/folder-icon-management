import { ref } from 'vue';
import taggedImagesDict from '../assets/tagged_images_dict.json';
/**
 * 图标加载器工具
 * 用于动态加载icons目录下的所有图标
 */

interface IconItem {
  name: string;
  path: string;
  keywords: string[]; // 关键词列表，用于搜索
  originalFileName: string; // 原始文件名，不含扩展名
  tags?: string[]; // 从AI标注数据中获取的标签
  isCustom?: boolean; // 是否为用户自定义图标
}

// 缓存已加载的图标
const iconCache = ref<IconItem[]>([]);
// 缓存用户自定义图标
const customIconCache = ref<IconItem[]>([]);

/**
 * 向主进程发送IPC请求获取数据
 * @param channel IPC通道名
 * @param args 可选参数
 * @returns 返回结果Promise
 */
const ipcInvoke = async <T>(channel: string, data?: any): Promise<T> => {
  if (!window.electron?.ipcRenderer) {
    console.error('IPC渲染器未初始化');
    return Promise.reject('IPC渲染器未初始化');
  }
  return window.electron.ipcRenderer.invoke(channel, data);
};

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

// 获取图标标签数据
const getIconTags = (fileName: string): string[] => {
  // 将文件名转换为与JSON文件中的键匹配的格式
  const tagKey = fileName.trim();
  
  // 从标签字典中获取标签数组
  if (taggedImagesDict && taggedImagesDict[tagKey]) {
    return taggedImagesDict[tagKey] as string[];
  }
  
  return [];
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
  // 如果缓存中有图标，直接返回
  if (iconCache.value.length > 0) {
    return iconCache.value;
  }

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
      
      // 获取AI标注的标签
      const tags = getIconTags(fileName);
      
      // 合并关键词和标签，确保唯一性
      const mergedKeywords = [...new Set([...keywords, ...tags])];
      
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
        keywords: mergedKeywords,
        originalFileName: nameWithoutExt,
        tags: tags,
        isCustom: false
      });
    });
    
    console.log('成功加载内置图标数量:', icons.length);
    
    // 调试：显示一些图标路径
    if (icons.length > 0) {
      console.log('第一个图标信息:', {
        name: icons[0].name,
        path: icons[0].path,
        originalFileName: icons[0].originalFileName,
        tags: icons[0].tags
      });
    }
    
    // 更新缓存
    iconCache.value = icons;
  } catch (error) {
    console.error('加载内置图标失败:', error);
  }
  
  return icons;
};

/**
 * 加载用户自定义图标
 * 从工作目录/source-icons加载用户添加的图标
 */
const loadCustomIcons = async (): Promise<IconItem[]> => {
  // 如果缓存中有自定义图标，直接返回
  if (customIconCache.value.length > 0) {
    return customIconCache.value;
  }

  const icons: IconItem[] = [];
  
  try {
    // 通过IPC获取用户自定义图标
    const customIcons = await ipcInvoke<Array<{ fileName: string, filePath: string }>>('load-custom-icons');
    
    if (customIcons && Array.isArray(customIcons)) {
      console.log('找到用户自定义图标:', customIcons.length);
      
      customIcons.forEach((icon: { fileName: string, filePath: string }) => {
        const { fileName, filePath } = icon;
        
        // 提取关键词 (只基于文件名，不使用标签)
        const keywords = extractKeywords(fileName);
        
        // 格式化显示名称
        const displayName = formatDisplayName(fileName);
        
        // 移除文件扩展名
        const nameWithoutExt = fileName.replace(/\.[^.]+$/, '');
        
        // 添加到图标列表
        icons.push({
          name: displayName,
          path: filePath, // 这里使用文件的绝对路径
          keywords: keywords,
          originalFileName: nameWithoutExt,
          isCustom: true // 标记为自定义图标
        });
      });
      
      console.log('成功加载用户自定义图标数量:', icons.length);
      
      // 更新缓存
      customIconCache.value = icons;
    }
  } catch (error) {
    console.error('加载用户自定义图标失败:', error);
  }
  
  return icons;
};

/**
 * 刷新自定义图标缓存
 * 用于在添加新图标后刷新列表
 */
export const refreshCustomIcons = (): void => {
  customIconCache.value = [];
};

/**
 * 获取所有可用图标
 * @returns 包含所有内置图标和自定义图标的数组
 */
export const getAllIcons = async (): Promise<IconItem[]> => {
  const builtInIcons = loadBuiltinIcons();
  const customIcons = await loadCustomIcons();
  
  console.log(`获取图标: 内置图标 ${builtInIcons.length}个, 自定义图标 ${customIcons.length}个`);
  return [...builtInIcons, ...customIcons];
};

/**
 * 根据名称获取图标
 * @param name 图标名称
 * @returns 图标信息，如果未找到则返回undefined
 */
export const getIconByName = async (name: string): Promise<IconItem | undefined> => {
  const allIcons = await getAllIcons();
  return allIcons.find(icon => icon.name.toLowerCase() === name.toLowerCase());
};

/**
 * 根据关键词搜索图标
 * @param keyword 搜索关键词
 * @returns 匹配的图标数组
 */
export const searchIcons = async (keyword: string): Promise<IconItem[]> => {
  if (!keyword) {
    return await getAllIcons();
  }
  
  const allIcons = await getAllIcons();
  const searchTerms = keyword.toLowerCase().split(/\s+/);
  
  return allIcons.filter(icon => {
    // 检查每个搜索词是否匹配任何关键词或标签
    return searchTerms.some(term => {
      // 优先精确匹配标签
      if (!icon.isCustom && icon.tags) {
        // 检查是否有完全匹配的标签
        if (icon.tags.some(tag => tag.toLowerCase() === term)) {
          return true;
        }
      }
      
      // 检查关键词匹配
      return icon.keywords.some(keyword => keyword.includes(term)) || 
      icon.name.toLowerCase().includes(term) ||
      icon.originalFileName.toLowerCase().includes(term) ||
        // 检查标签部分匹配 (仅适用于内置图标)
        (!icon.isCustom && icon.tags && icon.tags.some(tag => tag.toLowerCase().includes(term)));
    });
  });
};

/**
 * 根据标签搜索图标
 * @param tags 要搜索的标签数组
 * @returns 匹配的图标数组
 */
export const searchIconsByTags = async (tags: string[]): Promise<IconItem[]> => {
  if (!tags || tags.length === 0) {
    return await getAllIcons();
  }
  
  const allIcons = await getAllIcons();
  const searchTags = tags.map(tag => tag.toLowerCase());
  
  return allIcons.filter(icon => {
    // 检查图标是否包含任何搜索标签 (仅适用于内置图标)
    return !icon.isCustom && icon.tags && icon.tags.some(iconTag => 
      searchTags.some(searchTag => iconTag.toLowerCase() === searchTag)
    );
  });
};

export type { IconItem }; 