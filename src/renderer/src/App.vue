<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import IconSelector from './components/IconSelector/index.vue';
import FolderSelector from './components/FolderSelector/index.vue';
import IconApplier from './components/IconApplier/index.vue';
import IconManager from './components/IconManager/index.vue';
import LanguageSelector from './components/LanguageSelector/index.vue';
import { type IconItem } from './utils/iconLoader';
import { showSuccess, showError } from './utils/messageManager';

// 使用i18n国际化
const { t } = useI18n();

// 应用状态
const selectedIcon = ref<string | null>(null);
const selectedFolder = ref<string | null>(null);
const activeTab = ref('iconApply'); // 默认显示图标应用标签页

// 选中的图标信息
const currentIconInfo = ref<IconItem | null>(null);

// 图标管理器引用 - 为组件定义类型
type IconManagerInstance = {
  loadIconRecords: () => Promise<void>;
};
const iconManagerRef = ref<IconManagerInstance | null>(null);

// 当选择图标时
const handleIconSelect = (icon: IconItem) => {
  currentIconInfo.value = icon;
  showSuccess(t('iconSelector.iconSelected', [icon.name]));
};

// 打开GitHub链接
const openGitHub = () => {
  if (window.electron && window.electron.ipcRenderer) {
    window.electron.ipcRenderer.send('open-external-url', 'https://github.com/tigerai-tech/folder-icon-management');
  } else {
    window.open('https://github.com/tigerai-tech/folder-icon-management', '_blank');
  }
};

// 监听标签页变化，当切换到图标管理标签页时刷新数据
watch(activeTab, (newTabKey) => {
  if (newTabKey === 'iconManage' && iconManagerRef.value) {
    console.log('切换到图标管理标签页，刷新图标记录');
    iconManagerRef.value.loadIconRecords();
  }
});

// 初始化应用
onMounted(() => {
  // 监听IPC消息 - 确保electron对象存在
  if (window.electron && window.electron.ipcRenderer) {
    window.electron.ipcRenderer.on('icon-applied', (_) => {
      showSuccess(t('iconApplier.applySuccess'));
      
      // 如果图标管理器组件已加载，刷新其数据
      if (iconManagerRef.value) {
        console.log('图标已应用，刷新图标记录');
        iconManagerRef.value.loadIconRecords();
      }
    });
    
    window.electron.ipcRenderer.on('icon-apply-error', (_, errorMsg) => {
      showError(t('iconApplier.applyError', [errorMsg]));
    });
    
    // 添加新的监听器
    window.electron.ipcRenderer.on('icon-reset', () => {
      showSuccess(t('iconApplier.resetSuccess'));
      
      // 如果图标管理器组件已加载，刷新其数据
      if (iconManagerRef.value) {
        console.log('图标已重置，刷新图标记录');
        iconManagerRef.value.loadIconRecords();
      }
    });
    
    window.electron.ipcRenderer.on('icon-reset-error', (_, errorMsg) => {
      showError(t('iconApplier.resetError', [errorMsg]));
    });
  } else {
    console.warn('electron.ipcRenderer 不可用，可能在Web预览模式下运行');
  }
});
</script>

<template>
  <div class="container">
    <div class="header">
      <h1 class="title">{{ t('app.title') }}</h1>
      <LanguageSelector />
    </div>
    
    <a-card>
      <a-divider />
      
      <!-- 使用须知区域 -->
      <div class="notice-section">
        <a-alert 
          :message="t('app.usageNotice')" 
          :description="t('app.permissionTip')" 
          type="info" 
          show-icon 
          style="margin-bottom: 12px"
        />
        
        <div class="support-link">
          <a-button type="link" @click="openGitHub">
            {{ t('app.guideText') }}
          </a-button>
        </div>
      </div>
      
      <!-- 添加标签页 -->
      <a-tabs v-model:activeKey="activeTab">
        <a-tab-pane key="iconApply" :tab="t('app.funApplyIcon')">
          <a-space direction="vertical" size="large" style="width: 100%">
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
          </a-space>
        </a-tab-pane>
        
        <a-tab-pane key="iconManage" :tab="t('app.funIconMgr')">
          <!-- 图标管理组件 -->
          <IconManager ref="iconManagerRef" />
        </a-tab-pane>
      </a-tabs>
    </a-card>
  </div>
</template>

<style>
.container {
  padding: 20px;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  box-sizing: border-box;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.title {
  font-size: 24px;
  background: linear-gradient(to right, #18a058, #36ad6a);
  -webkit-background-clip: text;
  color: transparent;
  margin: 0;
}

.step-card {
  margin-bottom: 16px;
}

.notice-section {
  margin-bottom: 20px;
}

.support-link {
  text-align: right;
  margin-top: 4px;
}
</style>
