<script setup lang="ts">
import { ref, defineEmits, defineProps, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { getAllIcons, searchIcons, type IconItem } from '../../utils/iconLoader';
import { showSuccess, showError } from '../../utils/messageManager';
import { CloseOutlined } from '@ant-design/icons-vue';

defineProps<{
  selectedIcon: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:selectedIcon', value: string | null): void;
  (e: 'select', icon: IconItem): void;
}>();

// 使用i18n
const { t } = useI18n();

// 搜索关键词
const searchKeyword = ref('');

// 自定义图标
const customIcons = ref<{ name: string; path: string; data: string; filePath?: string }[]>([]);

// 图标URL输入
const iconUrl = ref('');

// 是否已经选中图标（用于过滤状态）
const isIconSelected = ref(false);

// 获取所有内置图标的原始列表
const allBuiltinIcons = getAllIcons();

// 使用增强的搜索函数过滤图标
const filteredBuiltinIcons = computed(() => {
  if (!searchKeyword.value) {
    return allBuiltinIcons;
  }
  
  return searchIcons(searchKeyword.value);
});

// 存储已选图标的绝对路径
const selectedIconPath = ref<string>('');

// 选择图标
const selectIcon = (icon: { name: string; path: string; filePath?: string; originalFileName?: string }) => {
  // 如果存在真实文件路径，优先使用，否则使用URL路径
  const finalPath = icon.filePath || icon.path;
  console.log('选择图标:', icon);
  console.log('图标最终路径:', finalPath);
  
  emit('update:selectedIcon', finalPath);
  emit('select', icon as IconItem);
  
  // 更新已选图标的路径显示
  if (icon.filePath) {
    // 对于本地文件，直接显示文件路径
    selectedIconPath.value = icon.filePath;
  } else if (icon.originalFileName) {
    // 对于内置图标，显示一个友好的"系统内置图标"路径
    selectedIconPath.value = `${t("iconSelector.defaultIconTab")}: ${icon.originalFileName}.png`;
  } else {
    // 其他情况
    selectedIconPath.value = icon.path;
  }
  
  // 如果是第一个选项卡，设置以此图标名进行搜索
  if (activeKey.value === 'default') {
    if (isIconSelected.value && searchKeyword.value) {
      // 如果之前已经选择并搜索过，现在重复点击相同的图标，取消选择
      clearSearch();
      isIconSelected.value = false;
    } else {
      // 否则进行搜索过滤
      const searchTerm = icon.originalFileName || icon.name.split(' ')[0]; // 使用原始文件名或显示名称的第一部分
      searchKeyword.value = searchTerm;
      isIconSelected.value = true;
    }
  }
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

// 下载图标URL并保存
const downloadIconFromUrl = async () => {
  if (!iconUrl.value) {
    showError(t('iconSelector.urlEmpty'));
    return;
  }
  
  try {
    // 检查URL格式是否有效
    try {
      new URL(iconUrl.value);
    } catch (e) {
      showError(t('iconSelector.invalidUrl'));
      return;
    }
    
    showSuccess(t('iconSelector.downloading'));
    
    // 调用主进程下载图标
    const result = await window.electron.ipcRenderer.invoke('download-icon-from-url', iconUrl.value);
    
    if (result.success) {
      const { filePath, fileName } = result;
      
      // 读取下载的图片文件为数据URL
      const response = await window.electron.ipcRenderer.invoke('read-file', filePath);
      const dataUrl = response.data;
      
      // 添加到自定义图标列表
      customIcons.value.push({
        name: fileName,
        path: dataUrl,
        data: dataUrl,
        filePath: filePath
      });
      
      showSuccess(t('iconSelector.downloadSuccess', [fileName]));
      
      // 清空URL输入框
      iconUrl.value = '';
    } else {
      showError(result.error || t('iconSelector.downloadFailed'));
    }
  } catch (error) {
    console.error('下载图标失败:', error);
    showError(t('iconSelector.downloadFailed'));
  }
};

// 打开原生文件选择对话框
const openIconFileDialog = async () => {
  try {
    const filePath = await window.api.selectIconFile();
    if (filePath) {
      // 获取文件名
      const fileName = filePath.split('/').pop() || 'icon.png';
      
      // 创建数据URL用于显示
      // 直接通过IPC调用读取文件
      const response = await window.electron.ipcRenderer.invoke('read-file', filePath);
      const dataUrl = response.data;
      
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

// 当前激活的选项卡
const activeKey = ref('default');

// 清除搜索
const clearSearch = () => {
  searchKeyword.value = '';
  isIconSelected.value = false;
};

// 清除已选中图标
const clearSelectedIcon = () => {
  emit('update:selectedIcon', null);
  selectedIconPath.value = '';
};

// 从自定义图标切换回内置图标时清空搜索
watch(activeKey, (newKey) => {
  if (newKey === 'default') {
    clearSearch();
  }
});
</script>

<template>
  <a-card :title="t('iconSelector.stepTitle')" class="step-card">
    <a-tabs v-model:activeKey="activeKey">
      <a-tab-pane key="default" :tab="t('iconSelector.defaultIconTab')">
        <!-- 添加搜索输入框 -->
        <div class="search-container">
          <a-input-search
            v-model:value="searchKeyword"
            :placeholder="t('iconSelector.searchPlaceholder')"
            style="width: 100%"
            allow-clear
            @clear="clearSearch"
          />
        </div>
        
        <div v-if="filteredBuiltinIcons.length === 0" class="no-results">
          <a-empty :description="t('iconSelector.noSearchResults')" />
        </div>
        
        <div class="icons-container">
          <a-row :gutter="[12, 12]">
            <a-col :span="6" v-for="icon in filteredBuiltinIcons" :key="icon.name" class="icon-item">
              <div 
                class="icon-wrapper" 
                :class="{ 
                  'selected': selectedIcon === icon.path,
                  'filtered': isIconSelected && searchKeyword
                }"
                @click="selectIcon(icon)"
              >
                <img 
                  :src="icon.path" 
                  width="64" 
                  style="object-fit: contain;"
                />
                <div class="icon-name">{{ icon.name }}</div>
                <div class="file-path">{{ icon.originalFileName }}.png</div>
              </div>
            </a-col>
          </a-row>
        </div>
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
            
            <a-button type="primary" ghost @click="openIconFileDialog" style="margin-right: 8px">
              {{ t('iconSelector.selectFileBtn') }}
            </a-button>
          </div>
        </div>
        
        <!-- 添加URL输入框 -->
        <div class="url-input-container">
          <p class="section-title">{{ t('iconSelector.fromUrl') }}</p>
          <a-input-search
            v-model:value="iconUrl"
            :placeholder="t('iconSelector.urlPlaceholder')"
            :enter-button="t('iconSelector.download')"
            @search="downloadIconFromUrl"
          />
          <p class="tip">{{ t('iconSelector.urlTip') }}</p>
        </div>
        
        <div v-if="customIcons.length > 0" class="icons-container custom-icons">
          <p class="section-title">{{ t('iconSelector.customIcons') }}</p>
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
    
    <!-- 显示已选中图标的路径 -->
    <a-divider v-if="selectedIconPath" orientation="left">已选中图标</a-divider>
    <div v-if="selectedIconPath" >
      <div class="path-row">
        <a-input 
          readonly 
          :value="selectedIconPath" 
          size="small"
          :addon-before="t('iconSelector.iconPath')"
        />
        <a-button type="text" class="clear-btn" @click="clearSelectedIcon">
          <template #icon><close-outlined /></template>
        </a-button>
      </div>
    </div>
  </a-card>
</template>

<style scoped>
.search-container {
  margin-bottom: 12px;
}

.no-results {
  margin-top: 20px;
  text-align: center;
}

.icons-container {
  min-height: 180px;
  max-height: 60vh; /* 使用视窗高度的百分比设置最大高度 */
  overflow-y: auto;
  margin-top: 12px;
  padding-right: 8px; /* 为滚动条预留空间 */
}

.custom-icons {
  margin-top: 12px;
}

.icon-item {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
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

.icon-wrapper.filtered {
  background-color: rgba(24, 160, 88, 0.05);
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

.url-input-container {
  margin-top: 20px;
  margin-bottom: 16px;
}

.section-title {
  font-weight: bold;
  margin-bottom: 8px;
  color: #333;
}

.tip {
  font-size: 12px;
  color: #888;
  margin-top: 6px;
}

.selected-icon-path {
  margin-top: 12px;
  padding: 10px;
  background-color: #fff;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.path-row {
  display: flex;
  align-items: center;
}

.clear-btn {
  margin-left: 8px;
}
</style>