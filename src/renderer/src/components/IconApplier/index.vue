<script setup lang="ts">
/// <reference path="../../../../preload/index.d.ts" />
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { showError, showConfirm, showSuccess } from '../../utils/messageManager';
import { FolderOutlined } from '@ant-design/icons-vue';

const props = defineProps<{
  selectedIcon: string | null;
  selectedFolder: string | null;
}>();

const emit = defineEmits<{
  (e: 'applied'): void;
}>();

// 使用i18n
const { t } = useI18n();

// 当前处理中状态
const isProcessing = ref(false);

// 获取当前选中的图标信息
const iconInfo = computed(() => {
  // 判断是否是内置图标（路径中包含特定标识）
  const isBuiltIn = props.selectedIcon && (
    props.selectedIcon.includes('app.asar') || 
    props.selectedIcon.includes('/icons/') || 
    props.selectedIcon.includes('/build/extra-resources/') || 
    props.selectedIcon.includes('/resources/')
  );
  
  // 从路径中提取图标名称
  let iconName = '';
  if (props.selectedIcon) {
    // 移除查询参数
    const cleanPath = props.selectedIcon.split('?')[0];
    // 获取文件名
    const parts = cleanPath.split('/');
    const fileName = parts[parts.length - 1];
    // 移除扩展名
    iconName = fileName.split('.')[0];
  }
  
  return {
    path: props.selectedIcon,
    name: iconName,
    isBuiltIn: isBuiltIn || false
  };
});

// 应用图标到文件夹
const applyIcon = async () => {
  if (!props.selectedIcon) {
    showError(t('iconApplier.noIconSelected'));
    return;
  }
  
  if (!props.selectedFolder) {
    showError(t('iconApplier.noFolderSelected'));
    return;
  }
  
  try {
    isProcessing.value = true;
    console.log('渲染进程: 选中的图标路径:', props.selectedIcon);
    console.log('渲染进程: 选中的文件夹路径:', props.selectedFolder);
    console.log('渲染进程: 图标信息:', iconInfo.value);

    // 应用图标到文件夹，包含图标信息
    const result = await window.electron.ipcRenderer.invoke('apply-icon', {
      folderPath: props.selectedFolder,
      iconPath: props.selectedIcon,
      iconName: iconInfo.value.name,
      isBuiltIn: iconInfo.value.isBuiltIn,
      originalIconPath: props.selectedIcon
    });
    
    if (result && result.success) {
      emit('applied');
    }
  } catch (error) {
    console.error('应用图标失败:', error);
    showError(t('iconApplier.applyError', [error]));
  } finally {
    isProcessing.value = false;
  }
};

// 重置文件夹图标（取消设置）
const resetFolderIcon = async () => {
  try {
    isProcessing.value = true;
    
    if (!props.selectedFolder) {
      showError(t('iconApplier.noFolderSelected'));
      return;
    }
    
    // 确认对话框
    const confirmed = await showConfirm(
      t('iconApplier.resetConfirmTitle'),
      t('iconApplier.resetConfirmContent')
    );
    
    if (confirmed) {
      // Use window.electron.ipcRenderer instead of window.api
      await window.electron.ipcRenderer.invoke('reset-icon', { 
        folderPath: props.selectedFolder, 
        deleteFile: true 
      });
      showSuccess(t('iconApplier.resetSuccess'));
    }
  } catch (error) {
    console.error('重置图标失败:', error);
    showError(t('iconApplier.resetError'));
  } finally {
    isProcessing.value = false;
  }
};
</script>

<template>
  <a-card :title="t('iconApplier.stepTitle')" class="step-card">
    <a-row :gutter="[16, 16]">
      <a-col :span="24">
        <a-descriptions bordered :column="1">
          <a-descriptions-item :label="t('iconApplier.selectedIcon')">
            <div class="selected-info" v-if="selectedIcon">
              <img :src="selectedIcon" class="small-icon" />
              {{ iconInfo.name }}
            </div>
            <a-tag v-else>{{ t('iconApplier.noIconSelected') }}</a-tag>
          </a-descriptions-item>
          
          <a-descriptions-item :label="t('iconApplier.selectedFolder')">
            <div class="selected-info" v-if="selectedFolder">
              <folder-outlined style="margin-right: 8px" />
              {{ selectedFolder }}
            </div>
            <a-tag v-else>{{ t('iconApplier.noFolderSelected') }}</a-tag>
          </a-descriptions-item>
        </a-descriptions>
      </a-col>
      
      <a-col :span="24">
        <div style="text-align: center; display: flex; justify-content: center; gap: 12px;">
          <a-button 
            type="primary" 
            @click="applyIcon" 
            :disabled="!selectedIcon || !selectedFolder || isProcessing"
            :loading="isProcessing"
            size="large"
          >
            {{ t('iconApplier.applyBtn') }}
          </a-button>
          
          <a-button 
            type="default" 
            @click="resetFolderIcon" 
            :disabled="!selectedFolder || isProcessing"
            :loading="isProcessing"
            size="large"
            danger
          >
            {{ t('iconApplier.resetBtn') }}
          </a-button>
        </div>
      </a-col>
    </a-row>
  </a-card>
</template>

<style scoped>
.selected-info {
  display: flex;
  align-items: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.small-icon {
  width: 24px;
  height: 24px;
  margin-right: 8px;
  object-fit: contain;
}
</style> 