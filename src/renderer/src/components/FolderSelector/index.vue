<script setup lang="ts">
import { ref, defineProps, defineEmits } from 'vue';
import { NIcon, NGradientText, NButton } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { FolderOpenOutline } from '@vicons/ionicons5';
import { selectFolder, handleFolderDrop as processFolderDrop } from '../../utils/folderIconManager';
import { showSuccess, showError } from '../../utils/messageManager';

defineProps<{
  selectedFolder: string | null;
}>();
const emit = defineEmits<{
  (e: 'update:selectedFolder', value: string | null): void;
}>();

// 使用i18n
const { t } = useI18n();

// 拖拽状态
const isDragging = ref(false);

// 处理文件夹拖拽
const handleFolderDrop = async (e: DragEvent) => {
  e.preventDefault();
  isDragging.value = false;
  console.log('文件夹拖拽事件触发');
  
  try {
    const folderPath = await processFolderDrop(e);
    
    if (folderPath) {
      emit('update:selectedFolder', folderPath);
      showSuccess(t('folderSelector.folderSelected', [folderPath]));
    } else {
      showError(t('folderSelector.invalidFolder'));
    }
  } catch (error) {
    console.error('处理拖拽文件夹时出错:', error);
    showError(t('folderSelector.folderError'));
  }
};

// 拖拽事件处理
const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

const handleDragEnter = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  isDragging.value = true;
};

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  isDragging.value = false;
};

// 打开文件夹选择对话框
const openFolderDialog = async () => {
  try {
    const folderPath = await selectFolder();
    
    if (folderPath) {
      emit('update:selectedFolder', folderPath);
      showSuccess(t('folderSelector.folderSelected', [folderPath]));
    }
  } catch (error) {
    console.error('选择文件夹失败:', error);
    showError(t('folderSelector.selectError'));
  }
};
</script>

<template>
  <n-card :title="t('folderSelector.stepTitle')" class="step-card">
    <div
      class="drop-area folder-drop"
      :class="{ 'dragging': isDragging }"
      @drop="handleFolderDrop"
      @dragover="handleDragOver"
      @dragenter="handleDragEnter"
      @dragleave="handleDragLeave"
      ondragstart="return false;"
      ondrop="return false;"
    >
      <div>
        <n-icon size="48" class="icon">
          <folder-open-outline />
        </n-icon>
        <n-gradient-text>{{ t('folderSelector.dragFolderTip') }}</n-gradient-text>
      </div>
      <p v-if="selectedFolder">{{ t('common.selected') }}: {{ selectedFolder }}</p>
    </div>
    
    <div style="margin-top: 12px; text-align: center;">
      <p>{{ t('common.or') }}</p>
      <n-button @click="openFolderDialog" type="primary" ghost>
        {{ t('folderSelector.selectFolderBtn') }}
      </n-button>
    </div>
  </n-card>
</template>

<style scoped>
.drop-area {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  transition: all 0.3s;
  cursor: pointer;
}

.drop-area:hover {
  border-color: #18a058;
  background-color: rgba(24, 160, 88, 0.1);
}

.drop-area.dragging {
  border-color: #18a058;
  background-color: rgba(24, 160, 88, 0.2);
  box-shadow: 0 0 10px rgba(24, 160, 88, 0.3);
}

.folder-drop {
  padding: 30px;
}

.icon {
  font-size: 48px;
  margin-bottom: 12px;
}
</style> 