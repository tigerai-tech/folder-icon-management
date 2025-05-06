<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';
import { NButton, NSpace } from 'naive-ui';
import { applyIconToFolder } from '../../utils/folderIconManager';
import { showSuccess, showError, showInfo } from '../../utils/messageManager';

const props = defineProps<{
  selectedIcon: string | null;
  selectedFolder: string | null;
}>();

const emit = defineEmits<{
  (e: 'applied'): void;
}>();

// 应用图标到文件夹
const applyIcon = async () => {
  if (!props.selectedIcon) {
    showError('请先选择一个图标');
    return;
  }
  
  if (!props.selectedFolder) {
    showError('请先选择一个文件夹');
    return;
  }
  
  try {
    showInfo('正在应用图标，请稍候...');

    await applyIconToFolder(props.selectedFolder, props.selectedIcon);
    
    showSuccess('图标已成功应用到文件夹');
    emit('applied');
  } catch (error) {
    console.error('应用图标失败:', error);
    showError(`应用图标失败: ${error}`);
  }
};
</script>

<template>
  <n-card title="步骤 3: 应用图标" class="step-card">
    <n-space justify="center">
      <n-button 
        type="primary" 
        @click="applyIcon" 
        :disabled="!selectedIcon || !selectedFolder"
        size="large"
      >
        应用图标到文件夹
      </n-button>
    </n-space>
  </n-card>
</template>

<style scoped>
/* 样式可在需要时添加 */
</style> 