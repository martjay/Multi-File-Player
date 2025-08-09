# Multi-File Player 多文件播放器

这是一个基于 Electron 开发的多文件媒体播放器，支持同时播放多个音频和视频文件，并提供丰富的控制功能。

## 功能特点

1. **多文件同时播放**：可以添加多个音频或视频文件同时播放
2. **单文件控制**：
   - 播放/暂停控制
   - 音量调节
   - 删除文件
3. **播放列表管理**：
   - 保存播放列表到 JSON 文件
   - 从 JSON 文件加载播放列表
4. **总体音量控制**：可以调节所有文件的整体音量
5. **循环播放**：支持循环播放功能，默认开启
6. **清空列表**：可以一键清空播放列表
7. **总体进度控制**：可以调节整个播放列表的播放进度
8. **拖放支持**：支持直接拖放文件到播放器窗口添加文件

## 安装和运行

1. 克隆或下载此项目
2. 进入项目目录
3. 安装依赖：
   ```
   npm install
   ```
4. 启动应用：
   ```
   npm start
   ```

## 构建为可执行文件

### 方法一：使用构建脚本

项目提供了几种构建脚本，可以一键打包为可执行文件：

1. **[simple-build.bat](file:///e:/AI-PJ/mult-player/simple-build.bat)** - Windows批处理脚本（选择构建目标）
2. **[build.ps1](file:///e:/AI-PJ/mult-player/build.ps1)** - PowerShell 脚本（选择构建目标）
3. **[build-mac.sh](file:///e:/AI-PJ/mult-player/build-mac.sh)** - macOS/Linux shell 脚本

### 方法二：使用 npm 命令

1. 安装依赖：
   ```
   npm install
   ```

2. 构建项目：
   ```
   # 仅构建 Windows 版本
   npm run dist
   
   # 仅构建 macOS 版本
   npm run dist-mac
   
   # 构建所有平台版本
   npm run dist-all
   ```

构建完成的可执行文件将位于 `dist` 目录中。

### 跨平台构建说明

本项目使用 Electron 和 electron-builder，可以构建跨平台的应用程序：

- **Windows**: `.exe` 安装程序和 `.zip` 便携版本
- **macOS**: `.dmg` 磁盘映像和 `.zip` 压缩包
- **Linux**: `AppImage` 和 `.deb` 包

注意：
1. 要构建 macOS 应用，您需要在 macOS 系统上运行构建命令
2. 要构建 Linux 应用，您需要在 Linux 系统上运行构建命令
3. Windows 应用可以在任何支持的系统上构建

### 自定义图标

为了构建带有自定义图标的安装程序，请在 [build](file:///e:/AI-PJ/mult-player/build) 目录中放置平台相关的图标文件：
- Windows: `icon.ico`
- macOS: `icon.icns`
- Linux: `icon.png` (512x512 pixels recommended)

## 使用说明

### 添加文件
1. 点击"添加文件"按钮，选择一个或多个音频或视频文件添加到播放列表
2. 或者直接将文件拖放到播放器窗口

### 播放控制
- 每个文件都有独立的播放/暂停按钮和音量控制滑块
- 可以通过"全部播放"按钮同时播放所有文件
- 可以通过"全部暂停"按钮暂停所有正在播放的文件

### 音量控制
- 每个文件有独立的音量控制滑块
- 顶部的"总体音量"滑块可以调节所有文件的整体音量

### 进度控制
- 顶部的"总体进度"滑块可以调节所有正在播放文件的进度

### 播放列表管理
- 点击"保存列表"按钮将当前播放列表保存为 JSON 文件
- 点击"加载列表"按钮从 JSON 文件加载播放列表

### 删除文件
点击文件条目右侧的"✖"按钮可以将该文件从播放列表中移除。

### 清空列表
点击"清空列表"按钮可以清空整个播放列表。

## 技术实现

- 使用 Electron 构建跨平台桌面应用
- 使用 HTML5 的 `<audio>` 和 `<video>` 元素播放媒体文件
- 通过 IPC 通信实现主进程和渲染进程间的数据交换
- 使用原生文件对话框进行文件选择和保存操作

## 支持的媒体格式

音频格式：
- MP3
- WAV
- OGG

视频格式：
- MP4
- WebM
- MOV
- AVI
- WMV

## 开发和定制

此项目结构简单清晰，易于扩展和定制：

- [main.js](file:///e:/AI-PJ/mult-player/main.js) - Electron 主进程文件
- [index.html](file:///e:/AI-PJ/mult-player/index.html) - 应用主界面
- [style.css](file:///e:/AI-PJ/mult-player/style.css) - 样式文件
- [renderer.js](file:///e:/AI-PJ/mult-player/renderer.js) - 渲染进程逻辑

可以根据需要添加更多功能，如：
- 播放进度控制
- 更多媒体格式支持
- 播放模式（顺序播放、随机播放等）
- 快捷键支持

## 故障排除

### 构建脚本闪退问题

如果双击批处理文件后出现闪退，请尝试以下解决方案：

1. **使用 PowerShell 脚本**：
   右键点击 [build.ps1](file:///e:/AI-PJ/mult-player/build.ps1) 文件，选择"使用 PowerShell 运行"

2. **以管理员身份运行**：
   右键点击批处理文件，选择"以管理员身份运行"

3. **从命令行运行**：
   打开命令提示符，导航到项目目录，然后运行：
   ```
   simple-build.bat
   ```

4. **检查 Node.js 和 npm**：
   确保已正确安装 Node.js 和 npm，并且它们已添加到系统 PATH 环境变量中

### 跨平台构建问题

1. **macOS 构建**：
   - 只能在 macOS 系统上构建 macOS 应用
   - 需要 Xcode 命令行工具

2. **Linux 构建**：
   - 只能在 Linux 系统上构建 Linux 应用
   - 可能需要安装额外的构建依赖

3. **代码签名**：
   - 发布应用时可能需要代码签名证书
   - 有关代码签名的详细信息，请参阅 Electron 和各平台的文档