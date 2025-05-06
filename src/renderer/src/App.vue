<script setup lang="ts">
import { ref, reactive, onMounted, inject } from 'vue'
import {
  NCard,
  NSpace,
  NTabs,
  NTabPane,
  NUpload,
  NUploadDragger,
  NGradientText,
  NButton,
  NGrid,
  NGridItem,
  NImage,
  NScrollbar,
  NDivider,
  NAlert,
  NMessageProvider,
  NDialogProvider,
  useMessage,
  NIcon
} from 'naive-ui'
import { FolderOpenOutline } from '@vicons/ionicons5'
import { h } from 'vue'

// 创建状态管理
const selectedIcon = ref<string | null>(null)
const selectedFolder = ref<string | null>(null)
const customIcons = ref<{ name: string; path: string; data: string }[]>([])
const defaultIcons = reactive([
  { 
    name: '默认蓝色', 
    path: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0Ij4KICA8cGF0aCBmaWxsPSIjNDI5OWUxIiBkPSJNMTAgNEg0Yy0xLjEgMC0xLjk5LjktMS45OSAyTDIgMThjMCAxLjEuOSAyIDIgMmgxNmMxLjEgMCAyLS45IDItMlY4YzAtMS4xLS45LTItMi0yaC04bC0yLTJ6Ii8+Cjwvc3ZnPg==' 
  },
  { 
    name: '红色', 
    path: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0Ij4KICA8cGF0aCBmaWxsPSIjZjU2NTY1IiBkPSJNMTAgNEg0Yy0xLjEgMC0xLjk5LjktMS45OSAyTDIgMThjMCAxLjEuOSAyIDIgMmgxNmMxLjEgMCAyLS45IDItMlY4YzAtMS4xLS45LTItMi0yaC04bC0yLTJ6Ii8+Cjwvc3ZnPg==' 
  },
  { 
    name: '绿色', 
    path: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0Ij4KICA8cGF0aCBmaWxsPSIjNDhhZTY1IiBkPSJNMTAgNEg0Yy0xLjEgMC0xLjk5LjktMS45OSAyTDIgMThjMCAxLjEuOSAyIDIgMmgxNmMxLjEgMCAyLS45IDItMlY4YzAtMS4xLS45LTItMi0yaC04bC0yLTJ6Ii8+Cjwvc3ZnPg==' 
  },
  { 
    name: '黄色', 
    path: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0Ij4KICA8cGF0aCBmaWxsPSIjZWNjOTRiIiBkPSJNMTAgNEg0Yy0xLjEgMC0xLjk5LjktMS45OSAyTDIgMThjMCAxLjEuOSAyIDIgMmgxNmMxLjEgMCAyLS45IDItMlY4YzAtMS4xLS45LTItMi0yaC04bC0yLTJ6Ii8+Cjwvc3ZnPg==' 
  },
  { 
    name: '紫色', 
    path: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0Ij4KICA8cGF0aCBmaWxsPSIjODA1YWQ1IiBkPSJNMTAgNEg0Yy0xLjEgMC0xLjk5LjktMS45OSAyTDIgMThjMCAxLjEuOSAyIDIgMmgxNmMxLjEgMCAyLS45IDItMlY4YzAtMS4xLS45LTItMi0yaC04bC0yLTJ6Ii8+Cjwvc3ZnPg==' 
  }
])

let message: ReturnType<typeof useMessage> | null = null;

// 初始化
onMounted(() => {
  message = useMessage();
  
  window.electron.ipcRenderer.on('icon-applied', (_) => {
    message?.success('图标已成功应用')
  })
  
  window.electron.ipcRenderer.on('icon-apply-error', (_, errorMsg) => {
    message?.error(`应用图标失败: ${errorMsg}`)
  })
})

// 拖拽事件处理
const handleFolderDrop = (e: DragEvent) => {
  e.preventDefault()
  console.log('文件夹拖拽事件触发')
  console.log('拖拽数据:', e.dataTransfer)
  
  if (e.dataTransfer?.files) {
    console.log('拖拽的文件数量:', e.dataTransfer.files.length)
    
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      console.log('拖拽的第一个文件:', file)
      // @ts-ignore
      console.log('文件路径:', file.path)
      
      // 直接尝试获取路径
      // @ts-ignore - Electron在files上添加的特殊属性
      const path = file.path
      
      if (path) {
        selectedFolder.value = path
        message?.success(`已选择文件夹: ${path}`)
        return
      }
    }
  }
  
  try {
    // 使用API中的方法作为备用
    const path = window.api.getDraggedFolderPath(e)
    console.log('API返回的路径:', path)
    
    if (path) {
      selectedFolder.value = path
      message?.success(`已选择文件夹: ${selectedFolder.value}`)
    } else {
      message?.error('请拖拽一个文件夹')
    }
  } catch (error) {
    console.error('处理拖拽文件夹时出错:', error)
    message?.error('处理文件夹时发生错误')
  }
}

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
}

const handleDragEnter = (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
}

// 图标拖拽上传
const handleIconDrop = (e: DragEvent) => {
  e.preventDefault()
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0]
    handleIconFile(file)
  }
}

// 处理图标文件
const handleIconFile = (file: File) => {
  if (!file) return
  
  const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml']
  if (!allowedTypes.includes(file.type)) {
    message?.error('只支持 PNG, JPG 和 SVG 格式的图标')
    return
  }
  
  const reader = new FileReader()
  reader.onload = (e) => {
    const data = e.target?.result as string
    customIcons.value.push({
      name: file.name,
      path: URL.createObjectURL(file),
      data
    })
    message?.success(`图标已添加: ${file.name}`)
  }
  reader.readAsDataURL(file)
}

// 选中图标
const selectIcon = (icon: { name: string; path: string }) => {
  selectedIcon.value = icon.path
  message?.info(`已选择图标: ${icon.name}`)
}

// 应用图标到文件夹
const applyIconToFolder = async () => {
  if (!selectedIcon.value) {
    message?.error('请先选择一个图标')
    return
  }
  
  if (!selectedFolder.value) {
    message?.error('请先选择一个文件夹')
    return
  }
  
  try {
    message?.info('正在应用图标，请稍候...')
    
    // 使用API
    await window.api.applyIconToFolder(selectedFolder.value, selectedIcon.value)
    message?.success('图标已成功应用到文件夹')
  } catch (error) {
    console.error('应用图标失败:', error)
    message?.error(`应用图标失败: ${error}`)
  }
}

// 打开文件夹选择对话框
const openFolderDialog = async () => {
  try {
    const folderPath = await window.api.selectFolder()
    console.log('选择的文件夹路径:', folderPath)
    
    if (folderPath) {
      selectedFolder.value = folderPath
      message?.success(`已选择文件夹: ${folderPath}`)
    }
  } catch (error) {
    console.error('选择文件夹失败:', error)
    message?.error('选择文件夹时发生错误')
  }
}
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
            <n-card title="步骤 1: 选择图标" class="step-card">
              <n-tabs type="line">
                <n-tab-pane name="default" tab="默认图标">
                  <n-scrollbar style="max-height: 240px">
                    <n-grid cols="4" x-gap="12" y-gap="12">
                      <n-grid-item v-for="icon in defaultIcons" :key="icon.name" class="icon-item">
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
                
                <n-tab-pane name="custom" tab="自定义图标">
                  <div
                    class="drop-area"
                    @drop="handleIconDrop"
                    @dragover.prevent
                    @dragenter.prevent
                  >
                    <n-upload-dragger @change="handleIconFile">
                      <div style="padding: 20px">
                        <n-gradient-text>拖拽上传图标或点击选择</n-gradient-text>
                        <p>支持 PNG, JPG 和 SVG 格式</p>
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
            
            <!-- 文件夹选择区域 -->
            <n-card title="步骤 2: 选择文件夹" class="step-card">
              <div
                class="drop-area folder-drop"
                @drop="handleFolderDrop"
                @dragover="handleDragOver"
                @dragenter="handleDragEnter"
              >
                <n-icon size="48" class="icon">
                  <folder-open-outline />
                </n-icon>
                <n-gradient-text>拖拽文件夹到这里</n-gradient-text>
                <p v-if="selectedFolder">已选择: {{ selectedFolder }}</p>
              </div>
              
              <div style="margin-top: 12px; text-align: center;">
                <p>或者</p>
                <n-button @click="openFolderDialog" type="primary" ghost>
                  点击选择文件夹
                </n-button>
              </div>
            </n-card>
            
            <!-- 应用按钮 -->
            <n-card title="步骤 3: 应用图标" class="step-card">
              <n-space justify="center">
                <n-button 
                  type="primary" 
                  @click="applyIconToFolder" 
                  :disabled="!selectedIcon || !selectedFolder"
                  size="large"
                >
                  应用图标到文件夹
                </n-button>
              </n-space>
            </n-card>
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

.folder-drop {
  padding: 30px;
}

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

.icon {
  font-size: 48px;
  margin-bottom: 12px;
}
</style>
