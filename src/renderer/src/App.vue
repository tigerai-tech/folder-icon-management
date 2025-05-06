<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  NCard,
  NSpace,
  NDivider,
  NAlert,
  NMessageProvider,
  NDialogProvider,
  NGradientText
} from 'naive-ui';
import IconSelector from './components/IconSelector/index.vue';
import FolderSelector from './components/FolderSelector/index.vue';
import IconApplier from './components/IconApplier/index.vue';
import { type IconItem } from './utils/iconLoader';
import { showSuccess, showError } from './utils/messageManager';

// 应用状态
const selectedIcon = ref<string | null>(null);
const selectedFolder = ref<string | null>(null);

// 选中的图标信息
const currentIconInfo = ref<IconItem | null>(null);

// 当选择图标时
const handleIconSelect = (icon: IconItem) => {
  currentIconInfo.value = icon;
  showSuccess(`已选择图标: ${icon.name}`);
};

// 初始化应用
onMounted(() => {
  // 监听IPC消息 - 确保electron对象存在
  if (window.electron && window.electron.ipcRenderer) {
    window.electron.ipcRenderer.on('icon-applied', (_) => {
      showSuccess('图标已成功应用');
    });
    
    window.electron.ipcRenderer.on('icon-apply-error', (_, errorMsg) => {
      showError(`应用图标失败: ${errorMsg}`);
    });
  } else {
    console.warn('electron.ipcRenderer 不可用，可能在Web预览模式下运行');
  }
});
</script>

<template>
  <n-message-provider>
    <n-dialog-provider>
      <n-space vertical class="container">
        <n-card>
          <n-gradient-text :size="24" type="info">Mac 文件夹图标管理器</n-gradient-text>
          <n-divider />
          
          <!-- 管理员权限提示 -->
          <n-alert type="warning" title="权限提示" style="margin-bottom: 16px">
            修改文件夹图标需要管理员权限。如果遇到权限错误，请确保已安装fileicon (sudo npm install -g fileicon)，并使用 sudo 运行此应用。
          </n-alert>
          
          <n-space vertical size="large">
            <!-- 图标选择区域 -->
            <IconSelector 
              v-model:selectedIcon="selectedIcon"
              @select="handleIconSelect"
            />
            
            <!-- 文件夹选择区域 -->
            <FolderSelector
                v-model:selectedFolder="selectedFolder"
            />
            
            <!-- 应用按钮 -->
            <IconApplier 
              :selectedIcon="selectedIcon"
              :selectedFolder="selectedFolder"
            />
          </n-space>
        </n-card>
      </n-space>
    </n-dialog-provider>
  </n-message-provider>
</template>

<style>
.container {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.step-card {
  margin-bottom: 16px;
}
</style>
