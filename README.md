# Mac Folder Icon Manager (Mac文件夹图标管理器)


A simple yet practical Mac folder icon management application that allows you to easily change folder icons.   
一个简单而实用的Mac文件夹图标管理应用程序，让您可以轻松地更改文件夹的图标。


## Features (功能)


- Built-in variety of beautiful folder icons
- Icon search functionality by name or keywords
- Support for drag-and-drop custom icons (PNG, JPG, and SVG formats)
- Support for downloading icons from URL
- Drag-and-drop folders to apply icons
- Clean and user-friendly interface
- Supports both Chinese and English interfaces

---

- 内置多种漂亮的文件夹图标
- 支持图标搜索功能，可按名称或关键词查找
- 支持拖放上传自定义图标（支持PNG、JPG和SVG格式）
- 支持从URL下载图标
- 拖放文件夹即可应用图标
- 简洁友好的用户界面
- 支持中英文界面


## Usage (使用方法)

1. **Select Icon**:
   - Choose an icon from the default icon library
    ![](./docs/apply-buildin-png.png)
   - Use custom icons: download, upload, or add an image from a URL
   ![](./docs/apply-upload-images.png)


2. **Select Folder**:
   - Method 1: Drag and drop the target folder into the designated area
   - Method 2: Click the button to select a folder from Finder

3. **Apply Icon**:
   - Click the "Apply Icon to Folder" button to complete the icon change


--- 
1. **选择图标 (Select Icon)**：
   - 从默认图标库中选择一个图标
     ![](./docs/apply-buildin-png.png)
   - 使用自定义图标：下载、上传或从URL添加图片
     ![](./docs/apply-upload-images.png)

2. **选择文件夹**：
   - 方法1：将目标文件夹拖放到指定区域
   - 方法2：点击按钮从Finder选择文件夹
   
3. **应用图标**：
   - 点击"应用图标到文件夹"按钮，即可完成图标更换

## Build from Source  (从源代码构建)

```bash
# 安装依赖
pnpm install

# 开发环境运行
pnpm dev

# 构建应用程序
pnpm build

# 构建macOS应用
pnpm build:mac
```

## Tech Stack (技术栈)

- Electron
- Vue 3
- TypeScript
- Ant Design Vue
- fileicon (for Mac folder icon modification / 用于Mac文件夹图标修改)

## Notes (注意事项)

This application requires permissions to modify folder icons, so you may be asked to provide system permissions during use.  

此应用需要权限来修改文件夹图标，因此在使用过程中可能会要求您提供系统权限。

## License (许可)

[MIT License](LICENSE)
