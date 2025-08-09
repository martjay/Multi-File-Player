const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

// 全局变量
let playlist = []; // 播放列表
let mediaElements = {}; // 媒体元素映射
let masterVolume = 1.0; // 总体音量 (0.0 - 1.0)
let loopPlayback = true; // 循环播放默认开启
let isUpdatingProgress = false; // 防止进度条更新时的循环调用

// 添加全局变量来存储媒体时长
let mediaDurations = {};

// DOM 元素
const playlistElement = document.getElementById('playlist');
const fileInput = document.getElementById('file-input');
const loadPlaylistInput = document.getElementById('load-playlist-input');
const masterVolumeControl = document.getElementById('master-volume');
const masterVolumeValue = document.getElementById('master-volume-value');
const masterProgressControl = document.getElementById('master-progress');
const masterProgressValue = document.getElementById('master-progress-value');
const playlistSection = document.querySelector('.playlist-section');

// 创建拖放覆盖层
const dropOverlay = document.createElement('div');
dropOverlay.className = 'drop-overlay';
dropOverlay.innerHTML = '<div class="drop-overlay-text">释放文件以添加到播放列表</div>';
playlistSection.appendChild(dropOverlay);

// 按钮元素
const addFilesBtn = document.getElementById('add-files-btn');
const savePlaylistBtn = document.getElementById('save-playlist-btn');
const loadPlaylistBtn = document.getElementById('load-playlist-btn');
const playAllBtn = document.getElementById('play-all-btn');
const pauseAllBtn = document.getElementById('pause-all-btn');
const loopToggleBtn = document.getElementById('loop-toggle-btn');
const clearListBtn = document.getElementById('clear-list-btn');

// 事件监听器
addFilesBtn.addEventListener('click', openFileSelector);
savePlaylistBtn.addEventListener('click', savePlaylist);
loadPlaylistBtn.addEventListener('click', loadPlaylist);
playAllBtn.addEventListener('click', playAll);
pauseAllBtn.addEventListener('click', pauseAll);
loopToggleBtn.addEventListener('click', toggleLoop);
clearListBtn.addEventListener('click', clearPlaylist);
masterVolumeControl.addEventListener('input', updateMasterVolume);
masterProgressControl.addEventListener('input', updateMasterProgress);

fileInput.addEventListener('change', handleFileSelection);
loadPlaylistInput.addEventListener('change', handlePlaylistLoad);

// 拖放事件监听器
document.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropOverlay.classList.add('visible');
});

document.addEventListener('dragleave', (event) => {
    event.preventDefault();
    // 检查是否离开了窗口
    if (event.relatedTarget === null) {
        dropOverlay.classList.remove('visible');
    }
});

document.addEventListener('drop', (event) => {
    event.preventDefault();
    dropOverlay.classList.remove('visible');
    
    // 处理拖放的文件
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) {
        files.forEach(file => {
            // 检查是否为媒体文件
            const ext = path.extname(file.path).toLowerCase();
            const mediaExtensions = ['.mp3', '.wav', '.ogg', '.mp4', '.webm', '.mov', '.avi', '.wmv'];
            
            if (mediaExtensions.includes(ext)) {
                addToPlaylist(file.path);
            }
        });
    }
});

// 打开文件选择器
function openFileSelector() {
    ipcRenderer.invoke('open-file-dialog').then(result => {
        if (!result.canceled) {
            result.filePaths.forEach(filePath => {
                addToPlaylist(filePath);
            });
        }
    });
}

// 处理文件选择
function handleFileSelection(event) {
    const files = Array.from(event.target.files);
    files.forEach(file => {
        addToPlaylist(file.path);
    });
    fileInput.value = ''; // 重置input以便可以再次选择相同文件
}

// 添加文件到播放列表
function addToPlaylist(filePath) {
    const id = Date.now() + Math.random(); // 简单的唯一ID生成
    const fileName = filePath.split('\\').pop().split('/').pop();
    
    const item = {
        id: id,
        path: filePath,
        name: fileName,
        volume: 1.0, // 初始音量
        playing: false
    };
    
    playlist.push(item);
    renderPlaylist();
    
    // 异步获取媒体时长
    getMediaDuration(item);
}

// 获取媒体时长
function getMediaDuration(item) {
    // 创建临时媒体元素来获取时长
    const media = document.createElement(item.path.match(/\.(mp4|webm|ogg|mov|avi|wmv)$/i) ? 'video' : 'audio');
    media.src = item.path;
    
    media.addEventListener('loadedmetadata', () => {
        mediaDurations[item.id] = media.duration;
        // 更新播放列表以显示时长
        renderPlaylist();
        media.remove();
    });
    
    media.addEventListener('error', () => {
        mediaDurations[item.id] = 0;
        media.remove();
    });
}

// 格式化时间显示
function formatTime(seconds) {
    if (isNaN(seconds) || seconds === 0) return '--:--';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 渲染播放列表
function renderPlaylist() {
    playlistElement.innerHTML = '';
    
    if (playlist.length === 0) {
        playlistElement.innerHTML = '<div class="empty-playlist">播放列表为空，请添加媒体文件</div>';
        // 禁用进度条
        masterProgressControl.disabled = true;
        masterProgressControl.value = 0;
        masterProgressValue.textContent = '0%';
        return;
    }
    
    // 启用进度条
    masterProgressControl.disabled = false;
    
    playlist.forEach(item => {
        const li = document.createElement('li');
        li.className = 'playlist-item';
        li.dataset.id = item.id;
        
        if (item.playing) {
            li.classList.add('playing');
        }
        
        // 获取媒体时长
        const duration = mediaDurations[item.id] || 0;
        const formattedDuration = formatTime(duration);
        
        li.innerHTML = `
            <div class="playlist-item-info">
                <div class="playlist-item-title"><span class="media-duration">${formattedDuration}</span> ${item.name}</div>
                <div class="playlist-item-path">${item.path}</div>
            </div>
            <div class="playlist-item-controls">
                <button class="solo-btn">S</button>
                <button class="mute-btn">🔊</button>
                <div class="volume-control">
                    <input type="range" min="0" max="100" value="${Math.round(item.volume * 100)}" class="volume-slider">
                </div>
                <button class="remove-btn">✖</button>
            </div>
        `;
        
        playlistElement.appendChild(li);
        
        // 添加事件监听器
        const soloBtn = li.querySelector('.solo-btn');
        const muteBtn = li.querySelector('.mute-btn');
        const volumeSlider = li.querySelector('.volume-slider');
        const removeBtn = li.querySelector('.remove-btn');
        
        soloBtn.addEventListener('click', () => toggleSoloMode(item.id));
        muteBtn.addEventListener('click', () => toggleMute(item.id));
        volumeSlider.addEventListener('input', (e) => updateItemVolume(item.id, e.target.value));
        removeBtn.addEventListener('click', () => removeItem(item.id));
    });
}

// 静音切换功能
function toggleMute(id) {
    const item = playlist.find(item => item.id === id);
    if (!item) return;
    
    // 切换静音状态
    item.muted = !item.muted;
    
    // 如果媒体元素存在，更新其静音状态
    if (mediaElements[id]) {
        mediaElements[id].muted = item.muted;
    }
    
    // 更新按钮图标
    const muteBtn = document.querySelector(`[data-id="${id}"] .mute-btn`);
    if (item.muted) {
        muteBtn.textContent = '🔇';
    } else {
        muteBtn.textContent = '🔊';
    }
}

// 切换SOLO模式
function toggleSoloMode(id) {
    const item = playlist.find(item => item.id === id);
    if (!item) return;
    
    // 切换当前项目的SOLO状态
    item.solo = !item.solo;
    
    // 更新按钮样式
    const soloBtn = document.querySelector(`[data-id="${id}"] .solo-btn`);
    if (item.solo) {
        soloBtn.classList.add('solo-active');
    } else {
        soloBtn.classList.remove('solo-active');
    }
    
    // 更新所有音频的静音状态
    updateMuteState();
    
    // 更新总体进度
    updateMasterProgressDisplay();
}

// 更新所有音频的静音状态
function updateMuteState() {
    // 获取所有激活SOLO模式的项目
    const soloItems = playlist.filter(item => item.solo);
    
    if (soloItems.length > 0) {
        // 如果有激活SOLO模式的项目
        playlist.forEach(item => {
            if (mediaElements[item.id]) {
                // 激活SOLO的项目取消静音，未激活SOLO的项目静音
                mediaElements[item.id].muted = !item.solo;
            }
        });
    } else {
        // 如果没有激活SOLO模式的项目，则取消所有项目的静音
        playlist.forEach(item => {
            if (mediaElements[item.id]) {
                mediaElements[item.id].muted = false;
            }
        });
    }
}

// 创建媒体播放器
function createMediaPlayer(item) {
    // 创建隐藏的媒体元素
    const media = document.createElement(item.path.match(/\.(mp4|webm|ogg|mov|avi|wmv)$/i) ? 'video' : 'audio');
    media.src = item.path;
    media.volume = item.volume * masterVolume;
    media.muted = item.muted || false; // 设置初始静音状态
    
    // 设置循环播放
    media.loop = loopPlayback;
    
    // 保存媒体元素引用
    mediaElements[item.id] = media;
    
    // 添加媒体事件监听器
    media.addEventListener('ended', () => {
        item.playing = false;
        const muteBtn = document.querySelector(`[data-id="${item.id}"] .mute-btn`);
        if (muteBtn) {
            // 检查是否为第一个音频项
            const isFirstItem = playlist.length > 0 && playlist[0].id === item.id;
            
            // 更新按钮状态
            if (item.muted) {
                muteBtn.textContent = '🔇';
            } else {
                muteBtn.textContent = '🔊';
            }
        }
        
        const playlistItem = document.querySelector(`[data-id="${item.id}"]`);
        if (playlistItem) {
            playlistItem.classList.remove('playing');
        }
        
        // 如果循环播放开启，重新播放
        if (loopPlayback) {
            media.play();
            item.playing = true;
            
            if (muteBtn) {
                // 检查是否为第一个音频项
                const isFirstItem = playlist.length > 0 && playlist[0].id === item.id;
                
                // 更新按钮状态
                if (item.muted) {
                    muteBtn.textContent = '🔇';
                } else {
                    muteBtn.textContent = '🔊';
                }
            }
            
            playlistItem.classList.add('playing');
        }
        
        // 更新总体进度
        updateMasterProgressDisplay();
    });
    
    // 添加时间更新事件
    media.addEventListener('timeupdate', () => {
        // 只有当媒体正在播放时才更新总体进度
        if (!isUpdatingProgress && item.playing) {
            updateMasterProgressDisplay();
        }
    });
}

// 更新单项音量
function updateItemVolume(id, volumePercent) {
    const volume = volumePercent / 100;
    const item = playlist.find(item => item.id === id);
    if (!item) return;
    
    item.volume = volume;
    
    // 如果媒体元素存在，更新其音量
    if (mediaElements[id]) {
        mediaElements[id].volume = volume * masterVolume;
    }
}

// 移除项目
function removeItem(id) {
    // 停止播放并移除媒体元素
    if (mediaElements[id]) {
        mediaElements[id].pause();
        delete mediaElements[id];
    }
    
    // 从播放列表中移除
    playlist = playlist.filter(item => item.id !== id);
    
    // 重新渲染播放列表
    renderPlaylist();
    
    // 更新总体进度
    updateMasterProgressDisplay();
}

// 更新总体音量
function updateMasterVolume(event) {
    masterVolume = event.target.value / 100;
    masterVolumeValue.textContent = `${event.target.value}%`;
    
    // 保存音量设置到本地存储
    localStorage.setItem('masterVolume', masterVolume.toString());
    
    // 更新所有媒体元素的音量
    Object.keys(mediaElements).forEach(id => {
        const item = playlist.find(item => item.id == id);
        if (item) {
            mediaElements[id].volume = item.volume * masterVolume;
        }
    });
}

// 更新总体进度显示
function updateMasterProgressDisplay() {
    if (playlist.length === 0) return;
    
    // 找到正在播放的媒体中持续时间最长的一个
    let longestMedia = null;
    let longestDuration = 0;
    
    playlist.forEach(item => {
        if (item.playing && mediaElements[item.id]) {
            const media = mediaElements[item.id];
            if (media.duration && media.duration > longestDuration) {
                longestDuration = media.duration;
                longestMedia = media;
            }
        }
    });
    
    // 如果没有正在播放的媒体，直接返回
    if (!longestMedia) return;
    
    // 使用最长媒体的进度更新进度条
    const progress = (longestMedia.currentTime / longestMedia.duration) * 100;
    masterProgressControl.value = progress;
    masterProgressValue.textContent = `${Math.round(progress)}%`;
}

// 更新总体进度（当用户拖动进度条时）
function updateMasterProgress(event) {
    if (playlist.length === 0) return;
    
    const progress = event.target.value / 100;
    masterProgressValue.textContent = `${event.target.value}%`;
    
    isUpdatingProgress = true;
    
    // 找到持续时间最长的媒体
    let longestMedia = null;
    let longestDuration = 0;
    let longestItem = null;
    
    playlist.forEach(item => {
        if (item.playing && mediaElements[item.id]) {
            const media = mediaElements[item.id];
            if (media.duration && media.duration > longestDuration) {
                longestDuration = media.duration;
                longestMedia = media;
                longestItem = item;
            }
        }
    });
    
    // 更新所有正在播放的媒体的进度
    playlist.forEach(item => {
        if (item.playing && mediaElements[item.id]) {
            const media = mediaElements[item.id];
            if (media && media.duration) {
                // 根据最长媒体的持续时间来设置所有媒体的进度
                if (longestItem && item.id === longestItem.id) {
                    // 这是持续时间最长的媒体，直接设置进度
                    media.currentTime = media.duration * progress;
                } else {
                    // 其他媒体，按比例设置进度
                    const ratio = media.duration / longestDuration;
                    media.currentTime = media.duration * progress * ratio;
                }
            }
        }
    });
    
    // 延迟重置标志，防止进度更新冲突
    setTimeout(() => {
        isUpdatingProgress = false;
    }, 100);
}

// 全部播放
function playAll() {
    playlist.forEach((item, index) => {
        if (!mediaElements[item.id]) {
            createMediaPlayer(item);
        }

        mediaElements[item.id].play();
        item.playing = true;

        // 只更新按钮图标，不添加样式类
        const muteBtn = document.querySelector(`[data-id="${item.id}"] .mute-btn`);
        if (muteBtn) {
            // 更新静音按钮状态
            if (item.muted) {
                muteBtn.textContent = '🔇';
            } else {
                muteBtn.textContent = '🔊';
            }
        }
    });

    // 取消所有音频的SOLO模式
    playlist.forEach(item => {
        item.solo = false;
        const soloBtn = document.querySelector(`[data-id="${item.id}"] .solo-btn`);
        if (soloBtn) {
            soloBtn.classList.remove('solo-active');
        }
    });

    // 取消所有音频的静音状态
    playlist.forEach(item => {
        item.muted = false;
        const muteBtn = document.querySelector(`[data-id="${item.id}"] .mute-btn`);
        if (muteBtn) {
            muteBtn.textContent = '🔊';
        }
        
        // 更新媒体元素的静音状态
        if (mediaElements[item.id]) {
            mediaElements[item.id].muted = false;
        }
    });

    // 更新静音状态
    updateMuteState();

    renderPlaylist();
    updateMasterProgressDisplay();
}

// 全部暂停
function pauseAll() {
    Object.keys(mediaElements).forEach(id => {
        mediaElements[id].pause();
        const item = playlist.find(item => item.id == id);
        if (item) {
            item.playing = false;
        }
    });

    // 注意：这里不取消SOLO模式和静音状态，保持它们的激活状态

    // 只更新按钮图标，不添加样式类
    playlist.forEach((item, index) => {
        const muteBtn = document.querySelector(`[data-id="${item.id}"] .mute-btn`);
        if (muteBtn) {
            // 保持静音状态不变，只更新图标
            if (item.muted) {
                muteBtn.textContent = '🔇';
            } else {
                muteBtn.textContent = '🔊';
            }
        }
    });

    renderPlaylist();
    updateMasterProgressDisplay();
}

// 切换播放/暂停
function togglePlayPause(id) {
    const item = playlist.find(item => item.id === id);
    if (!item) return;

    if (!mediaElements[id]) {
        createMediaPlayer(item);
    }

    const media = mediaElements[id];
    if (media.paused) {
        media.play();
        item.playing = true;
    } else {
        media.pause();
        item.playing = false;
    }

    // 更新按钮图标（但不改变样式类）
    const playPauseBtn = document.querySelector(`[data-id="${id}"] .play-pause-btn`);

    // 检查是否为第一个音频项，如果是，则始终显示播放按钮样式
    const isFirstItem = playlist.length > 0 && playlist[0].id === id;

    if (isFirstItem) {
        // 第一个音频项始终显示播放按钮图标
        playPauseBtn.textContent = '▶';
    } else {
        // 其他音频项根据实际状态显示图标
        if (media.paused) {
            playPauseBtn.textContent = '▶';
        } else {
            playPauseBtn.textContent = '⏸';
        }
    }

    // 更新播放列表样式
    const playlistItem = document.querySelector(`[data-id="${id}"]`);
    if (item.playing) {
        playlistItem.classList.add('playing');
    } else {
        playlistItem.classList.remove('playing');
    }

    // 更新总体进度
    updateMasterProgressDisplay();
}

// 切换循环播放
function toggleLoop() {
    loopPlayback = !loopPlayback;
    
    // 更新按钮样式
    if (loopPlayback) {
        loopToggleBtn.classList.add('loop-active');
    } else {
        loopToggleBtn.classList.remove('loop-active');
    }
    
    // 更新所有媒体元素的循环设置
    Object.keys(mediaElements).forEach(id => {
        mediaElements[id].loop = loopPlayback;
    });
}

// 清空播放列表
function clearPlaylist() {
    // 停止播放并移除所有媒体元素
    Object.keys(mediaElements).forEach(id => {
        mediaElements[id].pause();
        delete mediaElements[id];
    });
    
    // 清空播放列表
    playlist = [];
    
    // 重新渲染播放列表
    renderPlaylist();
}

// 保存播放列表
function savePlaylist() {
    if (playlist.length === 0) {
        ipcRenderer.invoke('show-message-box', {
            type: 'info',
            message: '播放列表为空，无需保存'
        });
        return;
    }
    
    const playlistData = {
        savedAt: new Date().toISOString(),
        items: playlist.map(item => ({
            path: item.path,
            name: item.name,
            volume: item.volume
        }))
    };
    
    ipcRenderer.invoke('save-playlist-dialog').then(result => {
        if (!result.canceled && result.filePath) {
            fs.writeFile(result.filePath, JSON.stringify(playlistData, null, 2), (err) => {
                if (err) {
                    ipcRenderer.invoke('show-message-box', {
                        type: 'error',
                        message: '保存播放列表时出错: ' + err.message
                    });
                } else {
                    ipcRenderer.invoke('show-message-box', {
                        type: 'info',
                        message: '播放列表已保存成功'
                    });
                }
            });
        }
    });
}

// 加载播放列表
function loadPlaylist() {
    ipcRenderer.invoke('load-playlist-dialog').then(result => {
        if (!result.canceled && result.filePaths.length > 0) {
            const filePath = result.filePaths[0];
            fs.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                    ipcRenderer.invoke('show-message-box', {
                        type: 'error',
                        message: '读取播放列表时出错: ' + err.message
                    });
                    return;
                }
                
                try {
                    const playlistData = JSON.parse(data);
                    
                    // 清空当前播放列表
                    Object.keys(mediaElements).forEach(id => {
                        mediaElements[id].pause();
                        delete mediaElements[id];
                    });
                    
                    playlist = [];
                    
                    // 加载新的播放列表
                    playlistData.items.forEach(item => {
                        const id = Date.now() + Math.random();
                        playlist.push({
                            id: id,
                            path: item.path,
                            name: item.name,
                            volume: item.volume || 1.0,
                            playing: false
                        });
                        
                        // 异步获取媒体时长
                        getMediaDuration({
                            id: id,
                            path: item.path,
                            name: item.name
                        });
                    });
                    
                    renderPlaylist();
                    
                    ipcRenderer.invoke('show-message-box', {
                        type: 'info',
                        message: `成功加载 ${playlistData.items.length} 个媒体文件`
                    });
                } catch (parseError) {
                    ipcRenderer.invoke('show-message-box', {
                        type: 'error',
                        message: '解析播放列表时出错: ' + parseError.message
                    });
                }
            });
        }
    });
}

// 处理播放列表加载
function handlePlaylistLoad(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    fs.readFile(file.path, 'utf8', (err, data) => {
        if (err) {
            ipcRenderer.invoke('show-message-box', {
                type: 'error',
                message: '读取播放列表时出错: ' + err.message
            });
            return;
        }
        
        try {
            const playlistData = JSON.parse(data);
            
            // 清空当前播放列表
            Object.keys(mediaElements).forEach(id => {
                mediaElements[id].pause();
                delete mediaElements[id];
            });
            
            playlist = [];
            
            // 加载新的播放列表
            playlistData.items.forEach(item => {
                const id = Date.now() + Math.random();
                playlist.push({
                    id: id,
                    path: item.path,
                    name: item.name,
                    volume: item.volume || 1.0,
                    playing: false
                });
                
                // 异步获取媒体时长
                getMediaDuration({
                    id: id,
                    path: item.path,
                    name: item.name
                });
            });
            
            renderPlaylist();
            
            ipcRenderer.invoke('show-message-box', {
                type: 'info',
                message: `成功加载 ${playlistData.items.length} 个媒体文件`
            });
        } catch (parseError) {
            ipcRenderer.invoke('show-message-box', {
                type: 'error',
                message: '解析播放列表时出错: ' + parseError.message
            });
        }
    });
    
    loadPlaylistInput.value = ''; // 重置input
}

// 初始化播放列表
renderPlaylist();

// 设置循环播放按钮初始状态
if (loopPlayback) {
    loopToggleBtn.classList.add('loop-active');
}

// 从本地存储加载保存的音量设置
function loadSavedSettings() {
    // 加载总体音量设置
    const savedVolume = localStorage.getItem('masterVolume');
    if (savedVolume !== null) {
        masterVolume = parseFloat(savedVolume);
        masterVolumeControl.value = masterVolume * 100;
        masterVolumeValue.textContent = `${Math.round(masterVolume * 100)}%`;
    }
}

// 页面加载完成后应用保存的设置
document.addEventListener('DOMContentLoaded', () => {
    loadSavedSettings();
    
    // 更新所有媒体元素的音量
    Object.keys(mediaElements).forEach(id => {
        const item = playlist.find(item => item.id == id);
        if (item) {
            mediaElements[id].volume = item.volume * masterVolume;
        }
    });
});
