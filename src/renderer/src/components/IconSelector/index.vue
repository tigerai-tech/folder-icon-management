<script setup lang="ts">
import { ref, defineEmits, defineProps } from 'vue';
import { useI18n } from 'vue-i18n';
import { getAllIcons, type IconItem } from '../../utils/iconLoader';
import { showSuccess, showError } from '../../utils/messageManager';
import { createBase64ImageFromFilePath } from '../../utils/fileUtils';

defineProps<{
  selectedIcon: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:selectedIcon', value: string): void;
  (e: 'select', icon: IconItem): void;
}>();

// 使用i18n
const { t } = useI18n();

// 自定义图标
const customIcons = ref<{ name: string; path: string; data: string; filePath?: string }[]>([]);

// 获取所有内置图标
const builtinIcons = getAllIcons();

// 选择图标
const selectIcon = (icon: { name: string; path: string; filePath?: string }) => {
  // 如果存在真实文件路径，优先使用，否则使用URL路径
  const finalPath = icon.filePath || icon.path;
  emit('update:selectedIcon', finalPath);
  emit('select', icon as IconItem);
};

// 处理图标拖拽上传
const handleIconDrop = (e: DragEvent) => {
  e.preventDefault();
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    handleIconFile(file);
  }
};

// 处理图标文件
const handleIconFile = (file: File) => {
  if (!file) return;
  
  const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml'];
  if (!allowedTypes.includes(file.type)) {
    showError(t('iconSelector.formatError'));
    return;
  }
  
  // 获取真实文件路径
  const filePath = window.api?.getFilePath?.(file);
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = e.target?.result as string;
    customIcons.value.push({
      name: file.name,
      // 保存blob URL用于显示
      path: URL.createObjectURL(file),
      data,
      // 保存真实文件路径用于应用
      filePath: filePath || undefined
    });
    showSuccess(t('iconSelector.iconAddedSuccess', [file.name]));
    
    console.log('文件路径:', filePath);
  };
  reader.readAsDataURL(file);
};

// 打开原生文件选择对话框
const openIconFileDialog = async () => {
  try {
    const filePath = await window.api.selectIconFile();
    if (filePath) {
      // 获取文件名
      const fileName = filePath.split('/').pop() || 'icon.png';
      
      // 创建数据URL用于显示
      const dataUrl = await createBase64ImageFromFilePath(filePath);
      
      customIcons.value.push({
        name: fileName,
        path: dataUrl,
        data: dataUrl,
        filePath: filePath
      });
      
      showSuccess(t('iconSelector.iconAddedSuccess', [fileName]));
      console.log('选择的文件路径:', filePath);
    }
  } catch (error) {
    console.error('选择图标文件失败:', error);
    showError(t('iconSelector.selectError'));
  }
};

// 处理文件输入变化
const handleFileInputChange = (e: Event) => {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    handleIconFile(input.files[0]);
  }
};

// 当前激活的选项卡
const activeKey = ref('default');
</script>

<template>
  <a-card :title="t('iconSelector.stepTitle')" class="step-card">
    <a-tabs v-model:activeKey="activeKey">
      <a-tab-pane key="default" :tab="t('iconSelector.defaultIconTab')">
        <a-row :gutter="[12, 12]" style="max-height: 240px; overflow-y: auto;">
          <a-col :span="6" v-for="icon in builtinIcons" :key="icon.name" class="icon-item">
            <div 
              class="icon-wrapper" 
              :class="{ 'selected': selectedIcon === icon.path }"
              @click="selectIcon(icon)"
            >
              <img 
                :src="icon.path" 
                width="64" 
                style="object-fit: contain;"
              />
              <div class="icon-name">{{ icon.name }}</div>
            </div>
          </a-col>
        </a-row>
      </a-tab-pane>
      
      <a-tab-pane key="custom" :tab="t('iconSelector.customIconTab')">
        <div
          class="drop-area"
          @drop="handleIconDrop"
          @dragover.prevent
          @dragenter.prevent
        >
          <div style="padding: 20px">
            <p class="gradient-text">{{ t('iconSelector.dragUploadTip') }}</p>
            <p>{{ t('iconSelector.supportFormats') }}</p>
            
            <a-button type="primary" ghost @click="openIconFileDialog">
              {{ t('iconSelector.selectFileBtn') }}
            </a-button>
          </div>
        </div>
        
        <div v-if="customIcons.length > 0" style="max-height: 240px; overflow-y: auto; margin-top: 12px;">
          <a-row :gutter="[12, 12]">
            <a-col :span="6" v-for="(icon, index) in customIcons" :key="index" class="icon-item">
              <div 
                class="icon-wrapper" 
                :class="{ 'selected': selectedIcon === (icon.filePath || icon.path) }"
                @click="selectIcon(icon)"
              >
                <img 
                  :src="icon.path" 
                  width="64" 
                  style="object-fit: contain;"
                />
                <div class="icon-name">{{ icon.name }}</div>
                <div v-if="icon.filePath" class="file-path">{{ icon.filePath }}</div>
              </div>
            </a-col>
          </a-row>
        </div>
      </a-tab-pane>
    </a-tabs>
  </a-card>
</template>

<style scoped>
.icon-item {
  display: flex;
  justify-content: center;
}

.icon-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.icon-wrapper:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.icon-wrapper.selected {
  background-color: rgba(24, 160, 88, 0.1);
  border: 2px solid #18a058;
}

.icon-name {
  margin-top: 8px;
  font-size: 12px;
  text-align: center;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-path {
  font-size: 9px;
  color: #888;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

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

.custom-file-input {
  cursor: pointer;
  display: inline-block;
  margin-top: 15px;
}

.gradient-text {
  background-image: linear-gradient(to right, #18a058, #36ad6a);
  -webkit-background-clip: text;
  color: transparent;
  font-weight: bold;
}
</style>