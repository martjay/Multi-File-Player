const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

// 添加这些参数来解决GPU相关问题
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-gpu-rasterization');
app.commandLine.appendSwitch('disable-software-rasterizer');

// 保持对窗口对象的全局引用，如果不这样做，窗口会在 JavaScript 对象被垃圾回收时自动关闭
let mainWindow;

function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  // 加载应用的 index.html
  mainWindow.loadFile('index.html');

  // 当窗口关闭时触发
  mainWindow.on('closed', function () {
    // 取消对窗口对象的引用，通常会存储窗口在数组中，这是删除相应元素的时候
    mainWindow = null;
  });
}

// 当 Electron 完成初始化并准备创建浏览器窗口时调用此方法
// 部分 API 只能在此事件发生后使用
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    // 通常在 macOS 上，当点击停靠栏图标且没有其他窗口打开时，会重新创建一个窗口
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// 当所有窗口都关闭时退出
app.on('window-all-closed', function () {
  // 在 macOS 上，除非用户用 Cmd + Q 确定退出，否则绝大部分应用和它们的菜单栏会保持激活状态
  if (process.platform !== 'darwin') app.quit();
});

// IPC 处理程序
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Media Files', extensions: ['mp3', 'wav', 'ogg', 'mp4', 'webm', 'mov', 'avi', 'wmv'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result;
});

ipcMain.handle('save-playlist-dialog', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '保存播放列表',
    defaultPath: 'playlist.json',
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result;
});

ipcMain.handle('load-playlist-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result;
});

ipcMain.handle('show-message-box', async (event, options) => {
  const result = await dialog.showMessageBox(mainWindow, options);
  return result;
});

// 在这个文件中，你可以包含应用程序的其他主进程代码
// 也可以拆分成几个文件，然后用 require 导入