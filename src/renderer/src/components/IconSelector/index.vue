<script setup lang="ts">
import { ref, defineEmits, defineProps } from 'vue';
import { NTabs, NTabPane, NGrid, NGridItem, NImage, NScrollbar, NUploadDragger } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { getAllIcons, type IconItem } from '../../utils/iconLoader';
import { showSuccess, showError } from '../../utils/messageManager';

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
const customIcons = ref<{ name: string; path: string; data: string }[]>([]);

// 获取所有内置图标
const builtinIcons = getAllIcons();

// 选择图标
const selectIcon = (icon: { name: string; path: string }) => {
  emit('update:selectedIcon', icon.path);
  emit('select', icon);
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
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = e.target?.result as string;
    customIcons.value.push({
      name: file.name,
      path: URL.createObjectURL(file),
      data
    });
    showSuccess(t('iconSelector.iconAddedSuccess', [file.name]));
  };
  reader.readAsDataURL(file);
};
</script>

<template>
  <n-card :title="t('iconSelector.stepTitle')" class="step-card">
    <n-tabs type="line">
      <n-tab-pane name="default" :tab="t('iconSelector.defaultIconTab')">
        <n-scrollbar style="max-height: 240px">
          <n-grid cols="4" x-gap="12" y-gap="12">
            <n-grid-item v-for="icon in builtinIcons" :key="icon.name" class="icon-item">
              <div 
                class="icon-wrapper" 
                :class="{ 'selected': selectedIcon === icon.path }"
                @click="selectIcon(icon)"
              >
                <n-image 
                  :src="icon.path" 
                  width="64" 
                  preview-disabled
                  object-fit="contain"
                />
                <div class="icon-name">{{ icon.name }}</div>
              </div>
            </n-grid-item>
          </n-grid>
        </n-scrollbar>
      </n-tab-pane>
      
      <n-tab-pane name="custom" :tab="t('iconSelector.customIconTab')">
        <div
          class="drop-area"
          @drop="handleIconDrop"
          @dragover.prevent
          @dragenter.prevent
        >
          <n-upload-dragger @change="handleIconFile">
            <div style="padding: 20px">
              <n-gradient-text>{{ t('iconSelector.dragUploadTip') }}</n-gradient-text>
              <p>{{ t('iconSelector.supportFormats') }}</p>
            </div>
          </n-upload-dragger>
        </div>
        
        <n-scrollbar v-if="customIcons.length > 0" style="max-height: 240px; margin-top: 12px">
          <n-grid cols="4" x-gap="12" y-gap="12">
            <n-grid-item v-for="(icon, index) in customIcons" :key="index" class="icon-item">
              <div 
                class="icon-wrapper" 
                :class="{ 'selected': selectedIcon === icon.path }"
                @click="selectIcon(icon)"
              >
                <n-image 
                  :src="icon.path" 
                  width="64" 
                  preview-disabled
                  object-fit="contain"
                />
                <div class="icon-name">{{ icon.name }}</div>
              </div>
            </n-grid-item>
          </n-grid>
        </n-scrollbar>
      </n-tab-pane>
    </n-tabs>
  </n-card>
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
</style> 