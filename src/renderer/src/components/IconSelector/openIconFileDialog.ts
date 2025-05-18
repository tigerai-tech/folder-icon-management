import { showSuccess, showError } from '@renderer/utils/messageManager';
import * as ipcHelper from '../../utils/ipcHelper';
import type { Ref } from 'vue';

// Interface for customIcon items
interface CustomIcon {
  name: string;
  path: string;
  data: string;
  filePath?: string;
}

// Get the customIcons from the parent component through injection
// This will be provided when the component is mounted
let customIcons: Ref<CustomIcon[]>;

// i18n t function will be provided from the parent component
let t: (key: string, values?: any[]) => string;

// Setup function to initialize the customIcons reference
export function setupCustomIcons(icons: Ref<CustomIcon[]>) {
  customIcons = icons;
}

// Setup function to initialize the i18n t function
export function setupI18n(translationFunc: (key: string, values?: any[]) => string) {
  t = translationFunc;
}

// 打开原生文件选择对话框
export const openIconFileDialog = async () => {
  if (!customIcons || !t) {
    console.error('customIcons or i18n not initialized');
    return;
  }
  
  try {
    if (!window.api?.selectIconFile) {
      throw new Error('API not available');
    }
    
    const filePath = await window.api.selectIconFile();
    if (filePath) {
      // 获取文件名
      const fileName = filePath.split('/').pop() || 'icon.png';

      // 创建数据URL用于显示
      // 直接通过IPC调用读取文件
      const response = await ipcHelper.readFileAsDataUrl(filePath);
      
      if (response.success && response.data) {
        const dataUrl = response.data;

        customIcons.value.push({
          name: fileName,
          path: dataUrl,
          data: dataUrl,
          filePath: filePath
        });

        showSuccess(t('iconSelector.iconAddedSuccess', [fileName]));
        console.log('选择的文件路径:', filePath);
      } else {
        throw new Error('Failed to read file data');
      }
    }
  } catch (error) {
    console.error('选择图标文件失败:', error);
    showError(t('iconSelector.selectError'));
  }
};
