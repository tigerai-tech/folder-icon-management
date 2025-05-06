<script setup lang="ts">
import { ref, defineProps, defineEmits } from 'vue';
import { useI18n } from 'vue-i18n';
import { FolderOutlined } from '@ant-design/icons-vue';
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

// 已选择的文件夹列表
const selectedFolders = ref<{ name: string; path: string }[]>([]);

// 处理文件夹拖拽
const handleFolderDrop = async (e: DragEvent) => {
  e.preventDefault();
  isDragging.value = false;
  console.log('文件夹拖拽事件触发');
  
  try {
    const folderPath = await processFolderDrop(e);
    
    if (folderPath) {
      // 获取文件夹名
      const folderName = folderPath.split('/').pop() || 'folder';
      
      // 将文件夹添加到列表中
      selectedFolders.value.push({
        name: folderName,
        path: folderPath
      });
      
      // 发出选择事件
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
      // 获取文件夹名
      const folderName = folderPath.split('/').pop() || 'folder';
      
      // 将文件夹添加到列表中
      selectedFolders.value.push({
        name: folderName,
        path: folderPath
      });
      
      // 发出选择事件
      emit('update:selectedFolder', folderPath);
      showSuccess(t('folderSelector.folderSelected', [folderPath]));
    }
  } catch (error) {
    console.error('选择文件夹失败:', error);
    showError(t('folderSelector.selectError'));
  }
};

// 选择文件夹
const selectFolderFromList = (folder: { name: string; path: string }) => {
  emit('update:selectedFolder', folder.path);
};
</script>

<template>
  <a-card :title="t('folderSelector.stepTitle')" class="step-card">
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
      <div style="padding: 20px">
        <folder-outlined class="icon" style="font-size: 48px; margin-bottom: 12px;" />
        <p class="gradient-text">{{ t('folderSelector.dragFolderTip') }}</p>
        
        <a-button type="primary" ghost @click="openFolderDialog" style="margin-top: 12px;">
          {{ t('folderSelector.selectFolderBtn') }}
        </a-button>
      </div>
    </div>
    
    <div v-if="selectedFolders.length > 0" style="max-height: 240px; overflow-y: auto; margin-top: 12px;">
      <a-row :gutter="[12, 12]">
        <a-col :span="24" v-for="(folder, index) in selectedFolders" :key="index" class="folder-item">
          <div 
            class="folder-wrapper" 
            :class="{ 'selected': selectedFolder === folder.path }"
            @click="selectFolderFromList(folder)"
          >
            <folder-outlined class="folder-icon" />
            <div class="folder-info">
              <div class="folder-name">{{ folder.name }}</div>
              <div class="folder-path">{{ folder.path }}</div>
            </div>
          </div>
        </a-col>
      </a-row>
    </div>
  </a-card>
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
  padding: 20px;
}

.icon {
  font-size: 48px;
  margin-bottom: 12px;
  color: #18a058;
}

.gradient-text {
  background-image: linear-gradient(to right, #18a058, #36ad6a);
  -webkit-background-clip: text;
  color: transparent;
  font-weight: bold;
  margin-bottom: 8px;
}

.folder-item {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 8px;
}

.folder-wrapper {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
}

.folder-wrapper:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.folder-wrapper.selected {
  background-color: rgba(24, 160, 88, 0.1);
  border: 2px solid #18a058;
}

.folder-icon {
  font-size: 24px;
  color: #18a058;
  margin-right: 12px;
}

.folder-info {
  display: flex;
  flex-direction: column;
  text-align: left;
  flex: 1;
}

.folder-name {
  font-size: 14px;
  font-weight: bold;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-path {
  font-size: 12px;
  color: #888;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style> 