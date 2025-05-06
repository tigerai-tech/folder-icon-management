export default {
  app: {
    title: 'Mac 文件夹图标管理器',
    permissionTip: '修改文件夹图标需要管理员权限。如果遇到权限错误，请确保已安装fileicon (sudo npm install -g fileicon)，并使用 sudo 运行此应用。'
  },
  common: {
    selected: '已选择',
    or: '或者',
    apply: '应用',
    success: '成功',
    error: '错误',
    warning: '警告',
    info: '信息'
  },
  iconSelector: {
    stepTitle: '步骤 1: 选择图标',
    defaultIconTab: '内置图标',
    customIconTab: '自定义图标',
    dragUploadTip: '拖拽上传图标或点击选择',
    supportFormats: '支持 PNG, JPG 和 SVG 格式',
    iconAddedSuccess: '图标已添加: {0}',
    iconSelected: '已选择图标: {0}',
    formatError: '只支持 PNG, JPG 和 SVG 格式的图标'
  },
  folderSelector: {
    stepTitle: '步骤 2: 选择文件夹',
    dragFolderTip: '拖拽文件夹到这里',
    selectFolderBtn: '点击选择文件夹',
    folderSelected: '已选择文件夹: {0}',
    invalidFolder: '请拖拽一个有效的文件夹',
    folderError: '处理文件夹时发生错误',
    selectError: '选择文件夹时发生错误'
  },
  iconApplier: {
    stepTitle: '步骤 3: 应用图标',
    applyBtn: '应用图标到文件夹',
    selectIconFirst: '请先选择一个图标',
    selectFolderFirst: '请先选择一个文件夹',
    applying: '正在应用图标，请稍候...',
    applySuccess: '图标已成功应用到文件夹',
    applyError: '应用图标失败: {0}'
  },
  languageSelector: {
    zh: '中文',
    en: '英文'
  }
}; 