export default {
  app: {
    title: 'Mac Folder Icon Manager',
    permissionTip: 'Modifying folder icons requires administrator permissions. If you encounter permission errors, make sure fileicon is installed (sudo npm install -g fileicon) and run this app with sudo.'
  },
  common: {
    selected: 'Selected',
    or: 'or',
    apply: 'Apply',
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Info'
  },
  iconSelector: {
    stepTitle: 'Step 1: Select Icon',
    defaultIconTab: 'Built-in Icons',
    customIconTab: 'Custom Icons',
    dragUploadTip: 'Drag and drop icon or click to select',
    selectFileBtn: 'Browse Local Icons',
    supportFormats: 'Supports PNG, JPG, and SVG formats',
    iconAddedSuccess: 'Icon added: {0}',
    iconSelected: 'Icon selected: {0}',
    formatError: 'Only PNG, JPG, and SVG formats are supported'
  },
  folderSelector: {
    stepTitle: 'Step 2: Select Folder',
    dragFolderTip: 'Drag folder here',
    selectFolderBtn: 'Click to select folder',
    folderSelected: 'Folder selected: {0}',
    invalidFolder: 'Please drag a valid folder',
    folderError: 'Error processing folder',
    selectError: 'Error selecting folder'
  },
  iconApplier: {
    stepTitle: 'Step 3: Apply Icon',
    applyBtn: 'Apply icon to folder',
    selectIconFirst: 'Please select an icon first',
    selectFolderFirst: 'Please select a folder first',
    applying: 'Applying icon, please wait...',
    applySuccess: 'Icon applied successfully',
    applyError: 'Error applying icon: {0}'
  },
  languageSelector: {
    zh: 'Chinese',
    en: 'English'
  }
}; 