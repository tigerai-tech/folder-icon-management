<script setup lang="ts">
import { ref, defineEmits, defineProps, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { getAllIcons, searchIcons, searchIconsByTags, refreshCustomIcons, type IconItem } from '../../utils/iconLoader';
import { showSuccess, showError } from '../../utils/messageManager';
import { CloseOutlined, TagOutlined } from '@ant-design/icons-vue';
import { openIconFileDialog, setupCustomIcons, setupI18n } from './openIconFileDialog';

// Import the IPC helper utilities that have proper type definitions
import * as ipcHelper from '../../utils/ipcHelper';

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

// 获取所有内置图标的列表
const builtinIcons = ref<IconItem[]>([]);
const loading = ref(true);

// 加载图标数据
const loadIcons = async () => {
  loading.value = true;
  try {
    builtinIcons.value = await getAllIcons();
  } catch (error) {
    console.error('加载图标失败:', error);
    showError(t('iconSelector.loadFailed'));
  } finally {
    loading.value = false;
  }
};

// 组件挂载时加载图标
onMounted(() => {
  loadIcons();
  // Initialize customIcons reference for the openIconFileDialog utility
  setupCustomIcons(customIcons);
  // Initialize i18n translation function
  setupI18n(t);
});

// 刷新图标列表
const refreshIcons = async () => {
  refreshCustomIcons(); // 清除自定义图标缓存
  await loadIcons();    // 重新加载所有图标
};

// 当前选中的标签用于过滤
const selectedTags = ref<string[]>([]);

// 所有可用标签集合
const allAvailableTags = computed(() => {
  // 从所有图标中提取标签并计算每个标签的使用频率
  const tagMap = new Map<string, number>();
  
  builtinIcons.value.forEach(icon => {
    if (icon.tags && icon.tags.length > 0) {
      icon.tags.forEach(tag => {
        const count = tagMap.get(tag) || 0;
        tagMap.set(tag, count + 1);
      });
    }
  });
  
  return ['gray', 'music', 'video', 'document', 'workspace', 'download', 'themes', 'application', 'note', 'book', 'sharprect']
});

// 实际用于显示的图标列表（解决异步计算属性的问题）
const displayIcons = ref<IconItem[]>([]);

// 监听过滤条件变化，更新显示的图标列表
watch([searchKeyword, selectedTags, builtinIcons], async () => {
  // 如果图标还在加载，不执行过滤
  if (loading.value) return;
  
  try {
    if (!searchKeyword.value && selectedTags.value.length === 0) {
      // 没有过滤条件，直接使用所有图标
      displayIcons.value = builtinIcons.value;
    } else {
      // 有搜索关键字或标签过滤
      let results = builtinIcons.value;
      
      // 先应用标签过滤
      if (selectedTags.value.length > 0) {
        results = await searchIconsByTags(selectedTags.value);
      }
      
      // 再应用关键字搜索
      if (searchKeyword.value) {
        const searchResults = await searchIcons(searchKeyword.value);
        displayIcons.value = searchResults.filter(icon => 
          selectedTags.value.length === 0 || results.some(r => r.path === icon.path)
        );
      } else {
        displayIcons.value = results;
      }
    }
  } catch (error) {
    console.error('过滤图标失败:', error);
    displayIcons.value = builtinIcons.value;
  }
}, { immediate: true });

// 存储已选图标的绝对路径
const selectedIconPath = ref<string>('');

// 选择标签进行过滤
const toggleTag = (tag: string) => {
  const index = selectedTags.value.indexOf(tag);
  if (index >= 0) {
    // 如果标签已经选中，则移除
    selectedTags.value.splice(index, 1);
    // 从搜索关键词中移除标签
    searchKeyword.value = searchKeyword.value.replace(tag, '').trim();
  } else {
    // 否则添加标签
    selectedTags.value.push(tag);
    // 添加标签到搜索关键词
    searchKeyword.value = searchKeyword.value ? `${searchKeyword.value} ${tag}` : tag;
  }
};

// 清除所有选中的标签
const clearTags = () => {
  selectedTags.value = [];
  searchKeyword.value = ''; // 同时清除搜索关键词
};

// 选择图标
const selectIcon = (icon: { name: string; path: string; filePath?: string; originalFileName?: string; tags?: string[] }) => {
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
    
    // 调用主进程下载图标，使用类型安全的ipcHelper工具函数
    const result = await ipcHelper.downloadIconFromUrl(iconUrl.value);
    
    if (result.success && result.filePath && result.fileName) {
      const { filePath, fileName } = result;
      
      // 读取下载的图片文件为数据URL
      const response = await ipcHelper.readFileAsDataUrl(filePath);
      
      if (response.success && response.data) {
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
        showError(t('iconSelector.readFileError'));
      }
    } else {
      showError(result.error || t('iconSelector.downloadFailed'));
    }
  } catch (error) {
    console.error('下载图标失败:', error);
    showError(t('iconSelector.downloadFailed'));
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

// 监听选项卡切换
watch(activeKey, async (newKey) => {
  if (newKey === 'default') {
    clearSearch();
    clearTags();
  } else if (newKey === 'custom') {
    // 尝试从source-icons文件夹加载自定义图标
    try {
      // 尝试打开或刷新自定义图标目录
      await ipcHelper.copyExampleIcons();
      refreshIcons();
    } catch (error) {
      console.error('加载自定义图标目录失败:', error);
    }
  }
});

// 打开自定义图标文件夹
const openCustomIconsFolder = async () => {
  try {
    await ipcHelper.openCustomIconsDirectory();
  } catch (error) {
    console.error('打开自定义图标目录失败:', error);
    showError(t('iconSelector.openFolderError'));
  }
};
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
        <a-alert type="info"
                 :message="t('iconSelector.useLocalSourceIconsHint')"
                 show-icon/>
        <!-- 标签过滤区域 -->
        <div class="tags-container" v-if="allAvailableTags.length > 0">
          <div class="tags-header">
            <span class="tags-title">
              <tag-outlined /> {{ t('iconSelector.tagFilter') }}
            </span>
            <a-button v-if="selectedTags.length > 0" type="link" size="small" @click="clearTags">{{ t('iconSelector.clearTags') }}</a-button>
          </div>
          <div class="tags-list">
            <a-tag 
              v-for="tag in allAvailableTags" 
              :key="tag"
              :color="selectedTags.includes(tag) ? '#18a058' : undefined"
              style="margin-bottom: 5px; cursor: pointer;"
              @click="toggleTag(tag)"
            >
              {{ tag }}
            </a-tag>
          </div>
        </div>
        
        <!-- 加载状态 -->
        <div v-if="loading" class="loading-container">
          <a-spin tip="加载图标中..."></a-spin>
        </div>
        
        <!-- 无结果提示 -->
        <div v-else-if="displayIcons.length === 0" class="no-results">
          <a-empty :description="t('iconSelector.noSearchResults')" />
        </div>
        
        <!-- 图标列表 -->
        <div v-else class="icons-container">
          <a-row :gutter="[12, 12]">
            <a-col :span="6" v-for="icon in displayIcons" :key="icon.name" class="icon-item">
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
              </div>
            </a-col>
          </a-row>
        </div>
      </a-tab-pane>
      
      <a-tab-pane key="custom" :tab="t('iconSelector.customIconTab')">
        <div>
          <p class="section-title">1. {{ t('iconSelector.chooseLocalImage') }}</p>
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
              
              <a-button @click="openCustomIconsFolder" style="margin-right: 8px">
                打开自定义图标文件夹
              </a-button>
              
              <a-button @click="refreshIcons" type="link">
                刷新图标
              </a-button>
            </div>
          </div>
        </div>

        
        <!-- 添加URL输入框 -->
        <div class="url-input-container">
          <p class="section-title">2. {{ t('iconSelector.fromUrl') }}</p>
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
              </div>
            </a-col>
          </a-row>
        </div>
        
        <!-- 显示用户自定义源图标 -->
        <div v-if="displayIcons.filter(icon => icon.isCustom).length > 0" class="icons-container source-icons">
          <p class="section-title">3. 自定义源图标</p>
          <a-row :gutter="[12, 12]">
            <a-col :span="6" v-for="icon in displayIcons.filter(icon => icon.isCustom)" :key="icon.name" class="icon-item">
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

.tags-container {
  margin-bottom: 16px;
  padding: 8px;
  background-color: #f9f9f9;
  border-radius: 4px;
}

.tags-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.tags-title {
  font-weight: bold;
  font-size: 14px;
  color: #333;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.icons-container {
  margin-top: 16px;
  max-height: 400px; 
  overflow-y: auto;
  padding-right: 8px;
}

.icon-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  border: 1px solid #eee;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  height: 120px;
  justify-content: space-between;
  position: relative;
}

.icon-wrapper:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-color: #1890ff;
}

.icon-wrapper.selected {
  border-color: #18a058;
  background-color: rgba(24, 160, 88, 0.1);
}

.icon-wrapper.filtered {
  border-color: #ff7a45;
  background-color: rgba(255, 122, 69, 0.1);
}

.icon-name {
  font-size: 12px;
  margin-top: 8px;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  width: 100%;
}

.icon-item {
  margin-bottom: 12px;
}

.drop-area {
  border: 2px dashed #ddd;
  border-radius: 4px;
  margin-bottom: 16px;
  text-align: center;
  transition: all 0.3s;
}

.drop-area:hover {
  border-color: #18a058;
  background-color: rgba(24, 160, 88, 0.05);
}

.gradient-text {
  font-weight: bold;
  font-size: 16px;
  background: linear-gradient(to right, #36d1dc, #5b86e5);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.url-input-container {
  margin-bottom: 20px;
}

.section-title {
  font-weight: bold;
  margin-bottom: 8px;
  color: #333;
}

.tip {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.no-results {
  margin-top: 20px;
  text-align: center;
}

.path-row {
  display: flex;
  align-items: center;
}

.clear-btn {
  margin-left: 8px;
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.custom-icons, .source-icons {
  margin-top: 24px;
  border-top: 1px solid #eee;
  padding-top: 16px;
}
</style>