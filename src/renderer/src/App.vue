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
import { useI18n } from 'vue-i18n';
import IconSelector from './components/IconSelector/index.vue';
import FolderSelector from './components/FolderSelector/index.vue';
import IconApplier from './components/IconApplier/index.vue';
import LanguageSelector from './components/LanguageSelector/index.vue';
import { type IconItem } from './utils/iconLoader';
import { showSuccess, showError } from './utils/messageManager';

// 使用i18n国际化
const { t } = useI18n();

// 应用状态
const selectedIcon = ref<string | null>(null);
const selectedFolder = ref<string | null>(null);

// 选中的图标信息
const currentIconInfo = ref<IconItem | null>(null);

// 当选择图标时
const handleIconSelect = (icon: IconItem) => {
  currentIconInfo.value = icon;
  showSuccess(t('iconSelector.iconSelected', [icon.name]));
};

// 初始化应用
onMounted(() => {
  // 监听IPC消息 - 确保electron对象存在
  if (window.electron && window.electron.ipcRenderer) {
    window.electron.ipcRenderer.on('icon-applied', (_) => {
      showSuccess(t('iconApplier.applySuccess'));
    });
    
    window.electron.ipcRenderer.on('icon-apply-error', (_, errorMsg) => {
      showError(t('iconApplier.applyError', [errorMsg]));
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
        <div class="header">
          <n-gradient-text :size="24" type="info">{{ t('app.title') }}</n-gradient-text>
          <LanguageSelector />
        </div>
        <n-card>
          <n-divider />
          
          <!-- 管理员权限提示 -->
          <n-alert type="warning" :title="t('common.warning')" style="margin-bottom: 16px">
            {{ t('app.permissionTip') }}
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

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.step-card {
  margin-bottom: 16px;
}
</style>
