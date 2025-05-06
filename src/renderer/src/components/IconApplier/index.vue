<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';
import { NButton, NSpace } from 'naive-ui';
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

    await applyIconToFolder(props.selectedFolder, props.selectedIcon);
    
    showSuccess(t('iconApplier.applySuccess'));
    emit('applied');
  } catch (error) {
    console.error('应用图标失败:', error);
    showError(t('iconApplier.applyError', [error]));
  }
};
</script>

<template>
  <n-card :title="t('iconApplier.stepTitle')" class="step-card">
    <n-space justify="center">
      <n-button 
        type="primary" 
        @click="applyIcon" 
        :disabled="!selectedIcon || !selectedFolder"
        size="large"
      >
        {{ t('iconApplier.applyBtn') }}
      </n-button>
    </n-space>
  </n-card>
</template>

<style scoped>
/* 样式可在需要时添加 */
</style> 