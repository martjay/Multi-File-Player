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

// 波形图实例
let wavesurfer = null;

// 音频分析相关变量
let audioAnalysisQueue = []; // 音频分析队列

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

// 初始化波形图
document.addEventListener('DOMContentLoaded', () => {
    initWaveSurfer();
    loadSavedSettings();
});

// 初始化WaveSurfer
function initWaveSurfer() {
    // 创建柱状频谱波形图（通过barWidth和barGap配置）
    wavesurfer = WaveSurfer.create({
        container: '#waveform',
        waveColor: '#4F4A85',
        progressColor: '#FF6B6B',
        cursorColor: '#fff',
        cursorWidth: 1,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        height: 100,
        responsive: true,
        normalize: true,
        interact: false, // 禁用交互，因为我们自己处理
    });
    
    // 启动时保持空白，不显示任何频谱
    console.log('WaveSurfer初始化完成，等待音频文件');
    
    // 监听点击事件，用于控制播放位置
    wavesurfer.on('interaction', (newTime) => {
        // 当用户点击波形图时，更新所有播放媒体的位置
        if (playlist.length === 0) return;
        
        // 找到持续时间最长的媒体
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
        
        if (!longestMedia) return;
        
        const progress = newTime / longestDuration;
        
        // 更新所有媒体元素的播放位置
        Object.keys(mediaElements).forEach(id => {
            const media = mediaElements[id];
            if (media && media.duration) {
                media.currentTime = media.duration * progress;
            }
        });
        
        // 更新主进度条
        masterProgressControl.value = progress * 100;
        masterProgressValue.textContent = `${Math.round(progress * 100)}%`;
    });
}

// 初始化音频分析系统
function initAudioAnalysis() {
    console.log('音频分析系统已初始化');
}

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
    
    console.log(`添加文件到播放列表: ${fileName}`);
    
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
    
    // 分析音频文件并生成频谱数据
    console.log(`开始分析音频文件: ${fileName}`);
    console.log(`调用 analyzeAudioFile，item:`, item);
    analyzeAudioFile(item);
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

// 分析音频文件并生成频谱数据
function analyzeAudioFile(item) {
    console.log(`analyzeAudioFile 被调用，文件: ${item.name}, 路径: ${item.path}`);
    
    // 只分析音频文件
    if (!item.path.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i)) {
        console.log(`跳过非音频文件: ${item.name}`);
        return;
    }
    
    console.log(`开始分析音频文件: ${item.name}`);
    
    try {
        // 创建音频上下文
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // 使用FileReader读取本地文件
        const fs = require('fs');
        fs.readFile(item.path, (err, data) => {
            if (err) {
                console.error(`读取文件失败: ${item.name}`, err);
                audioContext.close();
                return;
            }
            
            // 将Buffer转换为ArrayBuffer
            const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
            
            // 解码音频数据
            audioContext.decodeAudioData(arrayBuffer)
                .then(audioBuffer => {
                    console.log(`音频解码成功: ${item.name}`);
                    
                    // 生成频谱数据
                    const spectrumData = generateSpectrumFromBuffer(audioBuffer);
                    
                    // 存储频谱数据
                    item.spectrumData = spectrumData;
                    
                    console.log(`频谱数据生成成功: ${item.name}`, spectrumData.length);
                    
                    // 更新频谱显示
                    updateSpectrumFromPlaylist();
                    
                    // 关闭音频上下文
                    audioContext.close();
                })
                .catch(error => {
                    console.error(`音频解码失败: ${item.name}`, error);
                    audioContext.close();
                });
        });
    } catch (error) {
        console.error(`创建音频上下文失败: ${item.name}`, error);
    }
}

// 从音频缓冲区生成频谱数据
function generateSpectrumFromBuffer(audioBuffer) {
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    const channelData = audioBuffer.getChannelData(0); // 使用第一个声道
    
    // 创建256个频段的频谱数据
    const numBands = 256;
    const peaks = new Array(numBands).fill(0);
    
    // 简单的频谱分析：将音频数据分成256段，计算每段的RMS值
    const samplesPerBand = Math.floor(length / numBands);
    
    for (let i = 0; i < numBands; i++) {
        const startSample = i * samplesPerBand;
        const endSample = Math.min(startSample + samplesPerBand, length);
        
        let sum = 0;
        let count = 0;
        
        for (let j = startSample; j < endSample; j++) {
            if (j < channelData.length) {
                sum += channelData[j] * channelData[j];
                count++;
            }
        }
        
        if (count > 0) {
            // 计算RMS值并转换为0-1范围
            const rms = Math.sqrt(sum / count);
            peaks[i] = Math.min(1, rms * 10); // 放大并限制在0-1范围内
        }
    }
    
    return peaks;
}

// 根据播放列表更新频谱显示
function updateSpectrumFromPlaylist() {
    console.log('开始更新频谱显示');
    
    if (!wavesurfer) {
        console.log('wavesurfer未初始化');
        return;
    }
    
    if (playlist.length === 0) {
        console.log('updateSpectrumFromPlaylist: 播放列表为空，强制清空频谱显示');
        // 强制清空频谱显示
        try {
            wavesurfer.load('', [], 100);
            console.log('updateSpectrumFromPlaylist: 方法1完成');
            
            // 如果还是有问题，尝试销毁并重建
            setTimeout(() => {
                if (playlist.length === 0 && wavesurfer) {
                    try {
                        wavesurfer.destroy();
                        console.log('updateSpectrumFromPlaylist: 销毁wavesurfer实例');
                        initWaveSurfer();
                        console.log('updateSpectrumFromPlaylist: 重新初始化wavesurfer');
                    } catch (error) {
                        console.error('updateSpectrumFromPlaylist: 重新初始化失败:', error);
                    }
                }
            }, 100);
        } catch (error) {
            console.error('updateSpectrumFromPlaylist: 清空频谱失败:', error);
        }
        return;
    }
    
    // 计算混合频谱
    const mixedSpectrum = calculateMixedSpectrum();
    
    if (mixedSpectrum) {
        console.log('混合频谱计算成功，长度:', mixedSpectrum.length);
        console.log('频谱数据示例:', mixedSpectrum.slice(0, 10));
        
        // 更新wavesurfer显示
        try {
            wavesurfer.load('', [mixedSpectrum], 100);
            console.log('频谱显示更新成功');
        } catch (error) {
            console.error('更新频谱显示失败:', error);
        }
    } else {
        console.log('没有可用的频谱数据');
    }
}

// 计算混合频谱
function calculateMixedSpectrum() {
    console.log('开始计算混合频谱');
    
    if (playlist.length === 0) {
        console.log('播放列表为空，无法计算混合频谱');
        return null;
    }
    
    // 获取所有有频谱数据的音频项
    const itemsWithSpectrum = playlist.filter(item => item.spectrumData);
    
    console.log(`播放列表总项数: ${playlist.length}`);
    console.log(`有频谱数据的项数: ${itemsWithSpectrum.length}`);
    
    if (itemsWithSpectrum.length === 0) {
        console.log('没有音频项包含频谱数据');
        return null;
    }
    
    // 检查是否有独奏模式
    const hasSolo = itemsWithSpectrum.some(item => item.solo);
    console.log(`是否有独奏模式: ${hasSolo}`);
    
    // 根据独奏模式过滤音频项
    let activeItems = itemsWithSpectrum;
    if (hasSolo) {
        // 独奏模式：只处理被标记为独奏的音频
        activeItems = itemsWithSpectrum.filter(item => item.solo);
        console.log(`独奏模式：处理 ${activeItems.length} 个独奏音频`);
    } else {
        // 非独奏模式：处理所有非静音的音频
        activeItems = itemsWithSpectrum.filter(item => !item.muted);
        console.log(`非独奏模式：处理 ${activeItems.length} 个非静音音频`);
    }
    
    if (activeItems.length === 0) {
        console.log('没有活跃的音频项');
        return null;
    }
    
    // 创建256个频段的混合频谱
    const mixedSpectrum = new Array(256).fill(0);
    
    // 混合活跃音频的频谱数据
    activeItems.forEach((item, index) => {
        console.log(`处理音频项 ${index + 1}: ${item.name} (独奏: ${item.solo}, 静音: ${item.muted})`);
        
        if (item.spectrumData && item.spectrumData.length > 0) {
            // 根据音量调整频谱强度
            const volumeMultiplier = item.volume || 1.0;
            
            console.log(`音频项 ${item.name} 的音量: ${volumeMultiplier}`);
            console.log(`音频项 ${item.name} 的频谱数据长度: ${item.spectrumData.length}`);
            
            item.spectrumData.forEach((value, bandIndex) => {
                if (bandIndex < mixedSpectrum.length) {
                    mixedSpectrum[bandIndex] += value * volumeMultiplier;
                }
            });
        } else {
            console.log(`音频项 ${item.name} 没有有效的频谱数据`);
        }
    });
    
    // 归一化混合频谱
    const maxValue = Math.max(...mixedSpectrum);
    console.log(`混合频谱最大值: ${maxValue}`);
    
    if (maxValue > 0) {
        mixedSpectrum.forEach((value, index) => {
            mixedSpectrum[index] = value / maxValue;
        });
        console.log('频谱归一化完成');
    } else {
        console.log('混合频谱全为0，跳过归一化');
    }
    
    console.log('混合频谱计算完成');
    return mixedSpectrum;
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
        
        // 清空频谱显示
        if (wavesurfer) {
            try {
                wavesurfer.load('', [], 100);
                console.log('播放列表为空，频谱显示已清空');
            } catch (error) {
                console.error('清空频谱显示失败:', error);
            }
        }
        
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
    mediaElements[id].muted = item.muted;
    
    // 音频分析器增益节点更新已简化
    console.log(`音频源 ${id} 静音状态已更新`);
    
    // 更新按钮图标
    const muteBtn = document.querySelector(`[data-id="${id}"] .mute-btn`);
    if (item.muted) {
        muteBtn.textContent = '🔇';
    } else {
        muteBtn.textContent = '🔊';
    }
    
    // 更新波形图
    drawDynamicWaveform();
    
    // 更新频谱显示
    updateSpectrumFromPlaylist();
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
    
    // 更新波形图
    drawDynamicWaveform();
    
    // 更新频谱显示
    updateSpectrumFromPlaylist();
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
    
    // 更新波形图
    drawDynamicWaveform();
    
    // 更新频谱显示
    updateSpectrumFromPlaylist();
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
    
    // 连接到音频分析器
    connectAudioSource(item.id, media);
    
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
        drawDynamicWaveform();
    });
    
    // 添加时间更新事件
    media.addEventListener('timeupdate', () => {
        // 只有当媒体正在播放时才更新总体进度
        if (!isUpdatingProgress && item.playing) {
            updateMasterProgressDisplay();
            drawDynamicWaveform();
        }
    });
}

// 音频源管理（简化版）
function connectAudioSource(id, media) {
    console.log(`音频源 ${id} 已连接`);
}

// 断开音频源连接
function disconnectAudioSource(id) {
    console.log(`音频源 ${id} 已断开连接`);
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
    
    // 音频分析器增益节点更新已简化
    console.log(`音频源 ${id} 音量已更新`);
}

// 移除项目
function removeItem(id) {
    // 停止播放并移除媒体元素
    if (mediaElements[id]) {
        mediaElements[id].pause();
        delete mediaElements[id];
    }
    
    // 断开音频源连接
    disconnectAudioSource(id);
    
    // 从播放列表中移除
    playlist = playlist.filter(item => item.id !== id);
    
    // 重新渲染播放列表
    renderPlaylist();
    
    // 更新总体进度
    updateMasterProgressDisplay();
    drawDynamicWaveform();
    
    // 更新频谱显示
    updateSpectrumFromPlaylist();
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
        
            // 音频分析器增益节点更新已简化
    console.log('所有音频源音量已更新');
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
    
    // 更新波形图进度
    if (wavesurfer) {
        wavesurfer.seekTo(longestMedia.currentTime / longestDuration);
    }
    
    // 更新波形图
    drawDynamicWaveform();
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
    
    // 更新波形图进度
    if (wavesurfer && longestMedia) {
        wavesurfer.seekTo(progress);
    }
    
    // 更新波形图
    drawDynamicWaveform();
    
    // 延迟重置标志，防止进度更新冲突
    setTimeout(() => {
        isUpdatingProgress = false;
    }, 100);
}

// 更新频谱显示（基于播放列表中的音频文件）
function drawDynamicWaveform() {
    if (!wavesurfer) return;
    
    // 如果播放列表为空，清空频谱显示
    if (playlist.length === 0) {
        try {
            // 尝试清空频谱
            wavesurfer.load('', [], 100);
            console.log('drawDynamicWaveform: 播放列表为空，尝试清空频谱显示');
            
            // 如果还是有问题，尝试销毁并重建
            setTimeout(() => {
                if (playlist.length === 0 && wavesurfer) {
                    try {
                        wavesurfer.destroy();
                        console.log('drawDynamicWaveform: 销毁wavesurfer实例');
                        initWaveSurfer();
                        console.log('drawDynamicWaveform: 重新初始化wavesurfer');
                    } catch (error) {
                        console.error('drawDynamicWaveform: 重新初始化失败:', error);
                    }
                }
            }, 100);
        } catch (error) {
            console.error('drawDynamicWaveform: 清空频谱失败:', error);
        }
        return;
    }
    
    // 计算实际播放中的音频数量（排除静音和非播放状态的音频）
    const actuallyPlayingItems = playlist.filter(item => 
        item.playing && 
        !item.muted && 
        mediaElements[item.id] && 
        !mediaElements[item.id].muted
    );
    
    // 如果没有活跃的音频，保持空白
    if (actuallyPlayingItems.length === 0) {
        wavesurfer.load('', [], 100);
        console.log('drawDynamicWaveform: 没有活跃音频，清空频谱显示');
        return;
    }
    
    // 更新波形图上的音频活动指示器
    updateWaveformActivityIndicator(actuallyPlayingItems.length);
}

// 更新频谱数据（已移除实时更新逻辑）
function updateSpectrumData() {
    console.log('频谱数据更新已禁用，使用静态频谱显示');
}

// 绘制连续波形线（已由wavesurfer.js bars渲染器替代）
function drawWaveform(ctx, timeData) {
    // 这个函数现在只是占位符，实际的波形绘制由wavesurfer.js处理
    console.log('波形绘制已由wavesurfer.js bars渲染器处理');
}

// 更新播放进度显示（已由wavesurfer.js处理）
function updateWaveformProgress(ctx) {
    // 这个函数现在只是占位符，播放进度由wavesurfer.js自动处理
    console.log('播放进度已由wavesurfer.js自动处理');
}

// 更新波形图上的音频活动指示器
function updateWaveformActivityIndicator(activeCount) {
    // 获取波形图容器
    const waveformContainer = document.querySelector('#waveform');
    if (!waveformContainer) return;
    
    // 查找或创建活动指示器元素
    let activityIndicator = waveformContainer.querySelector('.audio-activity-indicator');
    if (!activityIndicator) {
        activityIndicator = document.createElement('div');
        activityIndicator.className = 'audio-activity-indicator';
        waveformContainer.appendChild(activityIndicator);
    }
    
    // 更新活动指示器内容
    activityIndicator.textContent = activeCount;
    activityIndicator.style.position = 'absolute';
    activityIndicator.style.top = '10px';
    activityIndicator.style.left = '10px';
    activityIndicator.style.background = 'rgba(0, 0, 0, 0.5)';
    activityIndicator.style.color = 'white';
    activityIndicator.style.padding = '2px 6px';
    activityIndicator.style.borderRadius = '2px';
    activityIndicator.style.fontSize = '10px';
    activityIndicator.style.fontFamily = 'Arial, sans-serif';
    activityIndicator.style.zIndex = '10';
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
    drawDynamicWaveform(); // 更新波形图
    
    // 更新频谱显示以反映播放状态
    updateSpectrumFromPlaylist();
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
    drawDynamicWaveform(); // 更新波形图
    
    // 更新频谱显示以反映播放状态
    updateSpectrumFromPlaylist();
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
    const muteBtn = document.querySelector(`[data-id="${id}"] .mute-btn`);

    // 更新按钮状态
    if (item.muted) {
        muteBtn.textContent = '🔇';
    } else {
        muteBtn.textContent = '🔊';
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
    drawDynamicWaveform(); // 更新波形图
    
    // 更新频谱显示以反映播放状态
    updateSpectrumFromPlaylist();
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
    
    // 音频源连接管理已简化
    console.log('所有音频源连接已清理');
    
    // 清空播放列表
    playlist = [];
    
    // 强制清空频谱显示（在重新渲染之前）
    if (wavesurfer) {
        try {
            // 尝试多种清空方法
            wavesurfer.load('', [], 100);
            console.log('方法1: wavesurfer.load 空数据');
            
            // 等待一下再尝试其他方法
            setTimeout(() => {
                if (wavesurfer) {
                    try {
                        // 方法2: 重新初始化wavesurfer
                        wavesurfer.destroy();
                        console.log('方法2: 销毁wavesurfer实例');
                        
                        // 重新创建wavesurfer
                        setTimeout(() => {
                            initWaveSurfer();
                            console.log('方法3: 重新初始化wavesurfer');
                        }, 50);
                    } catch (error) {
                        console.error('重新初始化wavesurfer失败:', error);
                    }
                }
            }, 50);
            
            console.log('播放列表已清空，频谱显示清空流程已启动');
        } catch (error) {
            console.error('强制清空频谱显示失败:', error);
        }
    }
    
    // 重新渲染播放列表
    renderPlaylist();
    
    // 再次确保频谱显示为空
    setTimeout(() => {
        if (wavesurfer && playlist.length === 0) {
            try {
                wavesurfer.load('', [], 100);
                console.log('延迟确认：频谱显示已清空');
            } catch (error) {
                console.error('延迟清空频谱显示失败:', error);
            }
        }
    }, 100);
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
                    
                                // 音频源连接管理已简化
            console.log('所有音频源连接已清理');
                    
                    playlist = [];
                    
                    // 加载新的播放列表
                    playlistData.items.forEach(item => {
                        const id = Date.now() + Math.random();
                        const playlistItem = {
                            id: id,
                            path: item.path,
                            name: item.name,
                            volume: item.volume || 1.0,
                            playing: false
                        };
                        
                        playlist.push(playlistItem);
                        
                        // 异步获取媒体时长
                        getMediaDuration(playlistItem);
                        
                        // 分析音频文件并生成频谱数据
                        console.log(`播放列表加载：开始分析音频文件: ${item.name}`);
                        analyzeAudioFile(playlistItem);
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
            
            // 音频源连接管理已简化
            console.log('所有音频源连接已清理');
            
            playlist = [];
            
            // 加载新的播放列表
            playlistData.items.forEach(item => {
                const id = Date.now() + Math.random();
                const playlistItem = {
                    id: id,
                    path: item.path,
                    name: item.name,
                    volume: item.volume || 1.0,
                    playing: false
                };
                
                playlist.push(playlistItem);
                
                // 异步获取媒体时长
                getMediaDuration(playlistItem);
                
                // 分析音频文件并生成频谱数据
                console.log(`播放列表加载：开始分析音频文件: ${item.name}`);
                analyzeAudioFile(playlistItem);
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
        
        // 更新所有媒体元素的音量
        Object.keys(mediaElements).forEach(id => {
            const item = playlist.find(item => item.id == id);
            if (item) {
                mediaElements[id].volume = item.volume * masterVolume;
            }
        });
    }
}