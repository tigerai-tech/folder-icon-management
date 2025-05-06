<script setup lang="ts">
import { ref, defineProps, defineEmits } from 'vue';
import { NIcon, NGradientText, NButton } from 'naive-ui';
import { FolderOpenOutline } from '@vicons/ionicons5';
import { selectFolder, handleFolderDrop as processFolderDrop } from '../../utils/folderIconManager';
import { showSuccess, showError } from '../../utils/messageManager';

defineProps<{
  selectedFolder: string | null;
}>();
const emit = defineEmits<{
  (e: 'update:selectedFolder', value: string | null): void;
}>();

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
      showSuccess(`已选择文件夹: ${folderPath}`);
    } else {
      showError('请拖拽一个有效的文件夹');
    }
  } catch (error) {
    console.error('处理拖拽文件夹时出错:', error);
    showError('处理文件夹时发生错误');
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
      showSuccess(`已选择文件夹: ${folderPath}`);
    }
  } catch (error) {
    console.error('选择文件夹失败:', error);
    showError('选择文件夹时发生错误');
  }
};
</script>

<template>
  <n-card title="步骤 2: 选择文件夹" class="step-card">
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
      <div v-if="false">
        <n-icon size="48" class="icon">
          <folder-open-outline />
        </n-icon>
        <n-gradient-text>拖拽文件夹到这里</n-gradient-text>
      </div>
      <div v-else class="drop-area">
        <n-gradient-text>选择要更换图标的文件夹</n-gradient-text>
      </div>
      <p v-if="selectedFolder">已选择: {{ selectedFolder }}</p>
    </div>
    
    <div style="margin-top: 12px; text-align: center;">
      <p>或者</p>
      <n-button @click="openFolderDialog" type="primary" ghost>
        点击选择文件夹
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