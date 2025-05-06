<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';
import { useI18n } from 'vue-i18n';
import { applyIconToFolder } from '../../utils/folderIconManager';
import { showSuccess, showError, showInfo } from '../../utils/messageManager';

const props = defineProps<{
  selectedIcon: string | null;
  selectedFolder: string | null;
}>();

const emit = defineEmits<{
  (e: 'applied'): void;
}>();

// 使用i18n
const { t } = useI18n();

// 应用图标到文件夹
const applyIcon = async () => {
  if (!props.selectedIcon) {
    showError(t('iconApplier.selectIconFirst'));
    return;
  }
  
  if (!props.selectedFolder) {
    showError(t('iconApplier.selectFolderFirst'));
    return;
  }
  
  try {
    showInfo(t('iconApplier.applying'));
    console.log('渲染进程: 选中的图标路径:', props.selectedIcon);
    console.log('渲染进程: 选中的文件夹路径:', props.selectedFolder);

    // 检查图标路径是否是app.asar中的内置图标或者数据URL
    let iconPathToUse = props.selectedIcon;
    
    // 需要处理的情况：
    // 1. 图标在app.asar中（路径包含app.asar）
    // 2. 图标是data:URL或blob:URL
    const needsProcessing = props.selectedIcon.includes('app.asar') || 
                         props.selectedIcon.startsWith('data:') || 
                         props.selectedIcon.startsWith('blob:');
    
    console.log('渲染进程: 图标需要处理:', needsProcessing);
    
    if (needsProcessing) {
      // 首先，尝试直接获取内部图标的真实路径（不复制到Downloads）
      if (window.api && window.api.getInternalIconPath) {
        console.log('渲染进程: 尝试直接获取内部图标路径');
        showInfo(t('iconApplier.preparingIcon'));
        
        try {
          const internalPathResult = await window.api.getInternalIconPath(props.selectedIcon);
          console.log('渲染进程: getInternalIconPath返回结果:', internalPathResult);
          
          if (internalPathResult.success && internalPathResult.iconPath) {
            console.log('渲染进程: 成功获取内部图标路径:', internalPathResult.iconPath);
            iconPathToUse = internalPathResult.iconPath;
            showInfo(t('iconApplier.iconReady'));
          } else {
            // 如果直接获取内部图标路径失败，回退到复制到Downloads的方法
            console.log('渲染进程: 无法直接获取内部图标路径，尝试复制到Downloads');
            
            if (window.api && window.api.copyIconToDownloads) {
              console.log('渲染进程: 开始调用copyIconToDownloads');
              showInfo(t('iconApplier.copyingIcon'));
              
              const result = await window.api.copyIconToDownloads(props.selectedIcon);
              console.log('渲染进程: copyIconToDownloads返回结果:', result);
              
              if (result.success && result.filePath) {
                console.log('渲染进程: 图标已复制到:', result.filePath);
                // 使用复制后的文件路径
                iconPathToUse = result.filePath;
                showInfo(t('iconApplier.iconCopied'));
              } else {
                console.error('渲染进程: 复制图标失败:', result.error);
                throw new Error(result.error || t('iconApplier.copyError'));
              }
            } else {
              console.error('渲染进程: copyIconToDownloads API不可用');
              throw new Error(t('iconApplier.apiError'));
            }
          }
        } catch (error) {
          console.error('渲染进程: 获取内部图标路径出错:', error);
          
          // 如果getInternalIconPath方法出错，尝试使用copyIconToDownloads作为备份
          if (window.api && window.api.copyIconToDownloads) {
            console.log('渲染进程: 尝试使用备用方法copyIconToDownloads');
            showInfo(t('iconApplier.copyingIcon'));
            
            const result = await window.api.copyIconToDownloads(props.selectedIcon);
            console.log('渲染进程: copyIconToDownloads返回结果:', result);
            
            if (result.success && result.filePath) {
              console.log('渲染进程: 图标已复制到:', result.filePath);
              // 使用复制后的文件路径
              iconPathToUse = result.filePath;
              showInfo(t('iconApplier.iconCopied'));
            } else {
              console.error('渲染进程: 复制图标失败:', result.error);
              throw new Error(result.error || t('iconApplier.copyError'));
            }
          } else {
            console.error('渲染进程: API不可用，无法处理图标');
            throw new Error(t('iconApplier.apiError'));
          }
        }
      } else {
        // 如果getInternalIconPath不可用，回退到之前的方法
        console.log('渲染进程: getInternalIconPath不可用，使用copyIconToDownloads');
        
        if (window.api && window.api.copyIconToDownloads) {
          console.log('渲染进程: 开始调用copyIconToDownloads');
          showInfo(t('iconApplier.copyingIcon'));
          
          const result = await window.api.copyIconToDownloads(props.selectedIcon);
          console.log('渲染进程: copyIconToDownloads返回结果:', result);
          
          if (result.success && result.filePath) {
            console.log('渲染进程: 图标已复制到:', result.filePath);
            // 使用复制后的文件路径
            iconPathToUse = result.filePath;
            showInfo(t('iconApplier.iconCopied'));
          } else {
            console.error('渲染进程: 复制图标失败:', result.error);
            throw new Error(result.error || t('iconApplier.copyError'));
          }
        } else {
          console.error('渲染进程: API不可用，无法复制图标');
          console.log('渲染进程: window.api是否存在:', !!window.api);
          console.log('渲染进程: window.api对象:', Object.keys(window.api || {}));
          throw new Error(t('iconApplier.apiError'));
        }
      }
    }

    console.log('渲染进程: 最终使用的图标路径:', iconPathToUse);
    
    // 应用图标到文件夹
    await applyIconToFolder(props.selectedFolder, iconPathToUse);
    
    showSuccess(t('iconApplier.applySuccess'));
    emit('applied');
  } catch (error) {
    console.error('应用图标失败:', error);
    showError(t('iconApplier.applyError', [error]));
  }
};

// 重置文件夹图标（取消设置）
const resetFolderIcon = async () => {
  if (!props.selectedFolder) {
    showError(t('iconApplier.selectFolderFirst'));
    return;
  }
  
  try {
    showInfo(t('iconApplier.resetting'));
    console.log('渲染进程: 重置文件夹图标:', props.selectedFolder);
    
    // 调用主进程方法重置图标
    await window.electron.ipcRenderer.invoke('reset-folder-icon', props.selectedFolder);
    
    showSuccess(t('iconApplier.resetSuccess'));
    emit('applied');
  } catch (error) {
    console.error('重置图标失败:', error);
    showError(t('iconApplier.resetError', [error]));
  }
};
</script>

<template>
  <a-card :title="t('iconApplier.stepTitle')" class="step-card">
    <div style="text-align: center; display: flex; justify-content: center; gap: 12px;">
      <a-button 
        type="primary" 
        @click="applyIcon" 
        :disabled="!selectedIcon || !selectedFolder"
        size="large"
      >
        {{ t('iconApplier.applyBtn') }}
      </a-button>
      
      <a-button 
        type="default" 
        @click="resetFolderIcon" 
        :disabled="!selectedFolder"
        size="large"
        danger
      >
        {{ t('iconApplier.resetBtn') }}
      </a-button>
    </div>
  </a-card>
</template>

<style scoped>
/* 样式可在需要时添加 */
</style> 