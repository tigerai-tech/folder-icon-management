<script setup lang="ts">
/// <reference path="../../../../preload/index.d.ts" />
import { ref, onMounted, defineExpose } from 'vue';
import { useI18n } from 'vue-i18n';
import { showSuccess, showError, showConfirm } from '../../utils/messageManager';
import { FolderOutlined, RedoOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { filePathToUrl } from '../../utils/pathUtils';

const { t } = useI18n();

// 工作目录设置
const workspacePath = ref('');
const loading = ref(false);
const iconRecords = ref<any[]>([]);
const restoringAll = ref(false);
const folderSearchKeyword = ref(''); // 添加用于文件夹路径搜索的关键字

/**
 * 向主进程发送IPC请求获取数据
 * @param channel IPC通道名
 * @param data 可选参数
 * @returns 返回结果Promise
 */
const ipcInvoke = async <T>(channel: string, data?: any): Promise<T> => {
  if (!window.electron?.ipcRenderer) {
    console.error('IPC渲染器未初始化');
    return Promise.reject('IPC渲染器未初始化');
  }
  return window.electron.ipcRenderer.invoke(channel, data);
};

// 获取当前工作目录
const getWorkspacePath = async () => {
  try {
    workspacePath.value = await ipcInvoke<string>('get-workspace');
    console.log('工作目录:', workspacePath.value);
    
    // 将工作目录保存到localStorage，供pathUtils.ts使用
    try {
      localStorage.setItem('workspacePath', workspacePath.value);
    } catch (e) {
      console.warn('无法保存工作目录到localStorage:', e);
    }
  } catch (error) {
    console.error('获取工作目录失败:', error);
    showError(t('iconManager.workspaceLoadError'));
  }
};

// 更改工作目录
const changeWorkspacePath = async () => {
  try {
    loading.value = true;
    const result = await ipcInvoke<{success: boolean; path?: string; error?: string}>('select-workspace');
    
    if (result.success) {
      workspacePath.value = result.path || '';
      showSuccess(t('iconManager.workspaceUpdated'));
      
      // 保存工作目录到localStorage
      try {
        localStorage.setItem('workspacePath', workspacePath.value);
      } catch (e) {
        console.warn('无法保存工作目录到localStorage:', e);
      }
      
      // 重新加载图标记录
      await loadIconRecords();
    } else if (result.error) {
      console.error('更改工作目录失败:', result.error);
      showError(result.error);
    }
  } catch (error) {
    console.error('更改工作目录出错:', error);
    showError(t('iconManager.workspaceUpdateError'));
  } finally {
    loading.value = false;
  }
};

// 加载已应用图标记录
const loadIconRecords = async () => {
  try {
    loading.value = true;
    const result = await ipcInvoke<{success: boolean; records: any[]; error?: string}>('get-applied-icons');
    
    if (result.success) {
      iconRecords.value = result.records;
      console.log('加载图标记录:', iconRecords.value);
    } else {
      console.error('加载图标记录失败:', result.error);
      showError(result.error || '');
    }
  } catch (error) {
    console.error('加载图标记录出错:', error);
    showError(t('iconManager.recordsLoadError'));
  } finally {
    loading.value = false;
  }
};

// 重置单个文件夹图标
const resetFolderIcon = async (folderPath: string) => {
  try {
    const confirmed = await showConfirm(
      t('iconManager.resetConfirmTitle'),
      t('iconManager.resetConfirmContent')
    );
    
    if (confirmed) {
      loading.value = true;
      // Replace the window.api call with a direct ipcRenderer call
      await window.electron.ipcRenderer.invoke('reset-icon', { 
        folderPath, 
        deleteFile: true 
      });
      
      // 从列表中移除该记录
      iconRecords.value = iconRecords.value.filter(record => record.folderPath !== folderPath);
      
      showSuccess(t('iconManager.resetSuccess'));
    }
  } catch (error) {
    console.error('重置图标失败:', error);
    showError(t('iconManager.resetError'));
  } finally {
    loading.value = false;
  }
};

// 一键恢复所有图标
const restoreAllIcons = async () => {
  try {
    const confirmed = await showConfirm(
      t('iconManager.restoreAllConfirmTitle'),
      t('iconManager.restoreAllConfirmContent')
    );
    
    if (confirmed) {
      restoringAll.value = true;
      const result = await ipcInvoke<{
        success: boolean;
        results?: {
          total: number;
          success: number;
          failed: number;
          errors: string[];
        };
        error?: string;
      }>('restore-all-icons');
      
      if (result.success && result.results) {
        const { results } = result;
        
        // 显示详细结果
        let message = t('iconManager.restoreAllResult', {
          total: results.total,
          success: results.success,
          failed: results.failed
        });
        
        showSuccess(message);
        
        // 如果有失败的项目，展示详细信息
        if (results.failed > 0 && results.errors.length > 0) {
          console.error('恢复失败的项目:', results.errors);
        }
        
        // 重新加载图标记录
        await loadIconRecords();
      } else {
        showError(result.error || t('iconManager.restoreAllError'));
      }
    }
  } catch (error) {
    console.error('恢复所有图标失败:', error);
    showError(t('iconManager.restoreAllError'));
  } finally {
    restoringAll.value = false;
  }
};

// 处理图片加载错误
const handleImageError = async (e: Event) => {
  const target = e.target as HTMLImageElement;
  const src = target.src;
  
  if (target) {
    if (src.startsWith('file://')) {
      console.log('文件URL加载失败，尝试使用IPC读取:', src);
      // Extract the original path from the record
      const originalPath = decodeURIComponent(src.replace('file://', ''));
      
      try {
        // Try to use the IPC bridge to load the image as base64
        const response = await window.api.getBase64FromFilePath(originalPath);
        if (response) {
          console.log('成功通过IPC读取图标内容');
          target.src = response;
          return;
        }
      } catch (error) {
        console.error('尝试通过IPC读取图像失败:', error);
        
        // Try to get the current record's workspacePath
        try {
          const workspacePath = await ipcInvoke<string>('get-workspace');
          console.log('获取当前工作路径:', workspacePath);
          
          if (workspacePath) {
            // Extract just the filename from the path
            const filename = originalPath.split('/').pop();
            if (filename) {
              // Try alternative path construction
              const alternativePath = `${workspacePath}/applied-icons/${filename}`;
              console.log('尝试替代路径:', alternativePath);
              
              const altResponse = await window.api.getBase64FromFilePath(alternativePath);
              if (altResponse) {
                console.log('成功通过替代路径读取图标');
                target.src = altResponse;
                return;
              }
            }
          }
        } catch (wsError) {
          console.error('获取工作路径失败:', wsError);
        }
      }
    }
    
    // Fallback to default icon
    target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0Ij48cGF0aCBmaWxsPSJub25lIiBkPSJNMCAwaDI0djI0SDB6Ii8+PHBhdGggZD0iTTMgM2gxOHYxOEgzVjN6Ii8+PC9zdmc+';
  }
};

// 过滤图标记录
const filteredIconRecords = () => {
  if (!folderSearchKeyword.value) {
    return iconRecords.value;
  }
  
  const keyword = folderSearchKeyword.value.toLowerCase();
  return iconRecords.value.filter(record => 
    record.folderPath.toLowerCase().includes(keyword)
  );
};

// 初始化：获取工作目录和已应用图标记录
onMounted(async () => {
  await getWorkspacePath();
  await loadIconRecords();
});

defineExpose({ loadIconRecords });
</script>

<template>
  <a-card :title="t('iconManager.title')" class="manager-card">
    <div class="workspace-section">
      <a-descriptions :title="t('iconManager.workspaceTitle')" :column="1" bordered>
        <a-descriptions-item :label="t('iconManager.workspacePathLabel')">
          <div class="workspace-input-container">
            <a-input
              v-model:value="workspacePath"
              readonly
              class="workspace-input"
              style="width: calc(100% - 90px)"
            />
            <a-button 
              type="primary"
              @click="changeWorkspacePath"
              class="change-button"
            >
              {{ t('iconManager.change') }}
            </a-button>
          </div>
        </a-descriptions-item>
      </a-descriptions>
      <div class="icloud-hint">
        <a-alert type="info"
                 :message="t('iconManager.workspaceICloudHint')"
                 show-icon/>
      </div>
    </div>
    
    <a-divider orientation="left">{{ t('iconManager.iconsTitle') }}</a-divider>
    
    <div class="actions-bar">
      <a-button 
        type="primary" 
        :loading="restoringAll" 
        @click="restoreAllIcons"
        :disabled="iconRecords.length === 0"
      >
        <template #icon><redo-outlined /></template>
        {{ t('iconManager.restoreAllBtn') }}
      </a-button>
    </div>
    
    <div class="search-bar">
      <a-input-search
        v-model:value="folderSearchKeyword"
        :placeholder="t('iconManager.searchPlaceholder')"
        style="width: 100%; margin-bottom: 16px"
        allow-clear
      >
        <template #prefix>
          <search-outlined />
        </template>
      </a-input-search>
    </div>
    
    <a-table 
      :dataSource="filteredIconRecords()" 
      :loading="loading"
      rowKey="folderPath"
      style="margin-top: 16px"
    >
      <a-table-column key="folderPath" :title="t('iconManager.folderPathColumn')" data-index="folderPath">
        <template #default="{ text }">
          <a-tooltip :title="text">
            <span class="folder-path">
              <folder-outlined style="margin-right: 8px" />
              {{ text }}
            </span>
          </a-tooltip>
        </template>
      </a-table-column>
      
      <a-table-column key="icon" :title="t('iconManager.iconColumn')" data-index="iconPath" width="100px">
        <template #default="{ record }">
          <img 
            :src="filePathToUrl(record.iconPath)"
            class="icon-preview" 
            :alt="record.sourceIconName"
            @error="handleImageError"
          />
        </template>
      </a-table-column>
      
      <a-table-column key="sourceIconName" :title="t('iconManager.sourceIconNameColumn')" data-index="sourceIconName">
        <template #default="{ text, record }">
          <a-tag :color="record.isBuiltIn ? 'blue' : 'green'">
            {{ record.isBuiltIn ? t('iconManager.builtIn') : t('iconManager.custom') }}
          </a-tag>
          {{ text }}
        </template>
      </a-table-column>
      
      <a-table-column key="appliedAt" :title="t('iconManager.appliedAtColumn')" data-index="appliedAt">
        <template #default="{ record }">
          {{ new Date(record.appliedAt).toLocaleString() }}
        </template>
      </a-table-column>
      
      <a-table-column key="action" :title="t('iconManager.actionColumn')" width="120px">
        <template #default="{ record }">
          <a-button 
            type="primary" 
            danger 
            size="small" 
            @click="resetFolderIcon(record.folderPath)"
          >
            <template #icon><delete-outlined /></template>
            {{ t('iconManager.resetBtn') }}
          </a-button>
        </template>
      </a-table-column>
    </a-table>
    
    <div v-if="filteredIconRecords().length === 0 && !loading" class="no-records">
      <a-empty :description="folderSearchKeyword ? t('iconManager.noSearchResults') : t('iconManager.noRecords')" />
    </div>
  </a-card>
</template>

<style scoped>
.manager-card {
  margin-top: 16px;
}

.workspace-section {
  margin-bottom: 24px;
}

.icloud-hint {
  margin-top: 16px;
}

.actions-bar {
  margin-bottom: 16px;
  display: flex;
  justify-content: flex-end;
}

.search-bar {
  margin-bottom: 8px;
}

.folder-path {
  display: inline-flex;
  align-items: center;
  max-width: 300px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.icon-preview {
  width: 48px;
  height: 48px;
  object-fit: contain;
}

.no-records {
  margin-top: 16px;
  padding: 24px;
  text-align: center;
}

.workspace-input {
  cursor: pointer;
}

.workspace-input-container {
  display: flex;
  gap: 8px;
  width: 100%;
  align-items: center;
}

.change-button {
  flex-shrink: 0;
  min-width: 80px;
}
</style> 