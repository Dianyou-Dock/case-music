import { ref, onMounted, onUnmounted, computed } from 'vue'
import { invoke } from "@tauri-apps/api/core"
import { useMessage } from 'naive-ui'

// Spotify Web Playback SDK 类型定义
declare global {
  interface Window {
    Spotify: any;
    SpotifyWebPlaybackSDKReady: boolean;
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

export interface SpotifyWebPlaybackState {
  context: {
    uri: string | null;
    metadata: Record<string, any> | null;
  };
  disallows: {
    pausing: boolean;
    peeking_next: boolean;
    peeking_prev: boolean;
    resuming: boolean;
    seeking: boolean;
    skipping_next: boolean;
    skipping_prev: boolean;
  };
  paused: boolean;
  position: number;
  duration: number;
  repeat_mode: number;
  shuffle: boolean;
  track_window: {
    current_track: SpotifyWebPlaybackTrack;
    previous_tracks: SpotifyWebPlaybackTrack[];
    next_tracks: SpotifyWebPlaybackTrack[];
  };
}

export interface SpotifyWebPlaybackTrack {
  uri: string;
  id: string | null;
  type: 'track' | 'episode' | 'ad';
  media_type: 'audio' | 'video';
  name: string;
  is_playable: boolean;
  album: {
    uri: string;
    name: string;
    images: { url: string }[];
  };
  artists: {
    uri: string;
    name: string;
  }[];
}

export default function useSpotifyWebPlayback() {
  const message = useMessage()
  const player = ref<any>(null);
  const deviceId = ref<string>('');
  const isReady = ref(false);
  const isConnected = ref(false);
  const isPremium = ref(false);
  const error = ref<string | null>(null);
  const currentState = ref<SpotifyWebPlaybackState | null>(null);
  const currentTrack = ref<SpotifyWebPlaybackTrack | null>(null);
  const isPlaying = ref(false);
  const position = ref(0);
  const duration = ref(0);
  
  // 播放模式状态：0=列表循环, 1=单曲循环, 2=随机播放
  const playMode = ref(0);
  
  // 播放模式手动切换标记
  const isManualModeChange = ref(false);
  
  // 保存Spotify真实状态，但不覆盖UI显示
  const spotifyActualMode = ref(0);
  
  // 获取播放模式信息
  const playModeInfo = computed(() => {
    const modes = [
      { name: '列表循环', icon: 'RepeatOutline', active: playMode.value === 0 },
      { name: '单曲循环', icon: 'RepeatOneOutline', active: playMode.value === 1 },
      { name: '随机播放', icon: 'ShuffleOutline', active: playMode.value === 2 }
    ];
    return modes[playMode.value];
  });
  
  // 根据Spotify状态同步播放模式
  const syncPlayModeFromSpotifyState = (state: SpotifyWebPlaybackState) => {
    const { repeat_mode, shuffle } = state;
    
    // 根据Spotify的状态确定真实模式
    const spotifyMode = shuffle ? 2 : (repeat_mode === 1 ? 1 : 0);
    
    // 总是更新Spotify真实状态，用于内部逻辑
    spotifyActualMode.value = spotifyMode;
    
    // 如果用户手动设置了模式，我们保持用户的选择
    if (isManualModeChange.value) {
      console.log('⚠️ 跳过Spotify状态同步，保持用户设置的播放模式:', playModeInfo.value.name);
      
      // 如果Spotify状态与用户设置不一致，尝试重新应用用户设置
      if (spotifyMode !== playMode.value) {
        console.log('🔄 检测到Spotify状态与用户设置不一致，重新应用用户设置');
        // 使用延迟执行，避免循环调用
        setTimeout(async () => {
          // 强制应用用户设置的播放模式
          try {
            console.log('🔄 强制应用用户设置的播放模式:', playModeInfo.value.name);
            switch (playMode.value) {
              case 0: // 列表循环
                await setShuffle(false);
                // 添加延迟
                await new Promise(resolve => setTimeout(resolve, 500));
                await setRepeatMode('context');
                break;
              case 1: // 单曲循环
                await setShuffle(false);
                // 添加延迟
                await new Promise(resolve => setTimeout(resolve, 500));
                await setRepeatMode('track');
                break;
              case 2: // 随机播放
                // 对于随机播放，先设置重复模式为off，再开启随机播放
                await setRepeatMode('off');
                // 添加延迟
                await new Promise(resolve => setTimeout(resolve, 500));
                await setShuffle(true);
                break;
            }
          } catch (err) {
            console.error('强制应用播放模式失败:', err);
          }
        }, 1000);
      }
      return;
    }
    
    // 只有当模式真的发生变化时才更新UI显示
    if (playMode.value !== spotifyMode) {
      console.log('🔄 从Spotify状态同步播放模式:', spotifyMode);
      playMode.value = spotifyMode;
    }
  };
  
  // 检查用户是否为 Premium 用户
  const checkPremiumStatus = async () => {
    try {
      const response = await invoke('get_current_user_profile') as {
        success: boolean;
        message: string;
        profile?: {
          product?: string;
        };
      };
      
      if (response.success && response.profile) {
        // 检查用户产品类型
        const product = response.profile.product;
        isPremium.value = product === 'premium';
        
        console.log('用户产品类型:', product);
        console.log('是否为 Premium 用户:', isPremium.value);
        
        if (!isPremium.value) {
          error.value = 'Spotify Web Playback SDK 需要 Premium 订阅。当前账户类型: ' + (product || 'free');
          return false;
        }
        
        return true;
      } else {
        console.error('获取用户信息失败:', response.message);
        error.value = '无法获取用户信息: ' + response.message;
        return false;
      }
    } catch (err: any) {
      console.error('检查 Premium 状态失败:', err);
      error.value = '检查 Premium 状态失败: ' + err.message;
      return false;
    }
  };
  
  // 验证 Token 权限范围
  const validateTokenScopes = async () => {
    try {
      const token = await getAccessToken();
      
      // 测试关键的 API 端点来验证权限
      const testResponse = await fetch('https://api.spotify.com/v1/me/player', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (testResponse.status === 403) {
        const errorText = await testResponse.text();
        if (errorText.includes('insufficient') || errorText.includes('scope')) {
          console.error('Token 权限不足，需要重新登录');
          error.value = 'Token 权限不足，请点击"强制重新登录"按钮重新获取权限';
          return false;
        }
      }
      
      // 状态码 200 或 204 表示有权限访问（可能没有播放设备但有权限）
      if (testResponse.status === 200 || testResponse.status === 204) {
        console.log('Token 权限验证通过');
        return true;
      }
      
      // 其他错误情况
      console.warn('Token 权限验证未通过，状态码:', testResponse.status);
      return false;
      
    } catch (err: any) {
      console.error('验证 Token 权限失败:', err);
      return false;
    }
  };
  
  // 初始化播放器
  const initPlayer = async () => {
    try {
      console.log('🎵 开始初始化 Spotify 播放器...');
      
      // 首先检查 Premium 状态
      const premiumValid = await checkPremiumStatus();
      
      if (!premiumValid || !isPremium.value) {
        console.log('❌ 用户不是 Premium 或验证失败，跳过播放器初始化');
        return;
      }
      console.log('✅ Premium 状态验证通过');
      
      // 验证 Token 权限范围
      const scopesValid = await validateTokenScopes();
      
      if (!scopesValid) {
        console.log('❌ Token 权限不足，跳过播放器初始化');
        return;
      }
      console.log('✅ Token 权限验证通过');
      
      // 等待SDK加载完成
      console.log('⏳ 等待 Spotify Web Playback SDK 加载...');
      await waitForSpotifyWebPlaybackSDK();
      console.log('✅ Spotify Web Playback SDK 已加载');
      
      // 获取访问令牌
      console.log('⏳ 获取访问令牌...');
      const token = await getAccessToken();
      console.log('✅ 访问令牌获取成功');
      
      // 创建播放器
      console.log('⏳ 创建 Spotify 播放器实例...');
      player.value = new window.Spotify.Player({
        name: 'CASE - AI 音乐助手',
        getOAuthToken: (cb: (token: string) => void) => {
          console.log('🔄 播放器请求 OAuth Token...');
          getAccessToken().then(token => {
            console.log('✅ OAuth Token 获取成功');
            cb(token);
          }).catch(err => {
            console.error('❌ OAuth Token 获取失败:', err);
            error.value = '获取Spotify令牌失败: ' + err.message;
          });
        },
        volume: 0.5
      });
      console.log('✅ 播放器实例创建成功');
      
      // 添加事件监听
      console.log('⏳ 设置播放器事件监听...');
      setupPlayerEvents();
      console.log('✅ 事件监听设置完成');
      
      // 连接到Spotify（添加超时机制）
      console.log('⏳ 连接到 Spotify...');
      const connectPromise = player.value.connect();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('连接超时')), 15000); // 15秒超时
      });
      
      const connected = await Promise.race([connectPromise, timeoutPromise]) as boolean;
      isConnected.value = connected;
      
      if (!connected) {
        console.error('❌ 无法连接到 Spotify');
        error.value = '无法连接到Spotify，请检查网络连接或重试';
      } else {
        console.log('✅ 成功连接到 Spotify');
        error.value = null; // 清除之前的错误
      }
    } catch (err: any) {
      console.error('❌ 初始化 Spotify 播放器失败:', err);
      
      if (err.message.includes('连接超时')) {
        error.value = 'Spotify 连接超时，请检查网络连接后重试';
      } else {
        error.value = '初始化Spotify播放器失败: ' + err.message;
      }
    }
  };
  
  // 等待SDK加载完成
  const waitForSpotifyWebPlaybackSDK = () => {
    return new Promise<void>((resolve, reject) => {
      if (window.SpotifyWebPlaybackSDKReady) {
        resolve();
        return;
      }
      
      // 设置超时
      const timeout = setTimeout(() => {
        reject(new Error('Spotify Web Playback SDK 加载超时'));
      }, 10000);
      
      window.onSpotifyWebPlaybackSDKReady = () => {
        clearTimeout(timeout);
        window.SpotifyWebPlaybackSDKReady = true;
        resolve();
      };
    });
  };
  
  // 获取访问令牌
  const getAccessToken = async (): Promise<string> => {
    try {
      const tokenInfo = await invoke('get_token_info') as {
        has_token: boolean,
        is_expired: boolean,
        expires_in: number,
        token: string
      };
      
      if (!tokenInfo.has_token) {
        throw new Error('没有有效的Spotify令牌');
      }
      
      if (tokenInfo.is_expired) {
        // 令牌已过期，尝试刷新
        return await invoke('get_valid_token') as string;
      }
      
      return tokenInfo.token;
    } catch (err: any) {
      // 如果获取token_info失败，尝试直接获取有效令牌
      try {
        return await invoke('get_valid_token') as string;
      } catch (e: any) {
        throw new Error('获取Spotify令牌失败: ' + e.message);
      }
    }
  };
  
  // 设置播放器事件
  const setupPlayerEvents = () => {
    if (!player.value) return;
    
    // 准备就绪
    player.value.addListener('ready', ({ device_id }: { device_id: string }) => {
      deviceId.value = device_id;
      isReady.value = true;
      console.log('🎉 Spotify播放器已准备就绪，设备ID:', device_id);
    });
    
    // 未准备就绪
    player.value.addListener('not_ready', ({ device_id }: { device_id: string }) => {
      isReady.value = false;
      console.log('⚠️ Spotify播放器未准备就绪:', device_id);
    });
    
    // 播放状态变化
    player.value.addListener('player_state_changed', (state: SpotifyWebPlaybackState | null) => {
      if (!state) {
        currentState.value = null;
        currentTrack.value = null;
        isPlaying.value = false;
        return;
      }
      
      currentState.value = state;
      currentTrack.value = state.track_window.current_track;
      isPlaying.value = !state.paused;
      position.value = state.position;
      duration.value = state.duration;
      
      // 同步播放模式状态
      syncPlayModeFromSpotifyState(state);
    });
    
    // 错误处理
    player.value.addListener('initialization_error', ({ message }: { message: string }) => {
      error.value = '初始化错误: ' + message;
      console.error('播放器初始化错误:', message);
    });
    
    player.value.addListener('authentication_error', ({ message }: { message: string }) => {
      error.value = '认证错误: ' + message;
      console.error('播放器认证错误:', message);
    });
    
    player.value.addListener('account_error', ({ message }: { message: string }) => {
      error.value = '账户错误: ' + message;
      isPremium.value = false;
      console.error('播放器账户错误:', message);
    });
    
    player.value.addListener('playback_error', ({ message }: { message: string }) => {
      error.value = '播放错误: ' + message;
      console.error('播放器播放错误:', message);
    });
  };
  
  // 播放控制
  const play = async (spotifyUri: string) => {
    if (!isPremium.value) {
      error.value = 'Spotify Web Playback SDK 需要 Premium 订阅';
      return;
    }
    
    if (!deviceId.value) {
      error.value = '播放器未准备就绪';
      return;
    }
    
    try {
      const token = await getAccessToken();
      const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId.value}`, {
        method: 'PUT',
        body: JSON.stringify({ uris: [spotifyUri] }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`播放失败 (${response.status}): ${errorText}`);
      }
      
      console.log('开始播放:', spotifyUri);
    } catch (err: any) {
      error.value = '播放失败: ' + err.message;
      console.error('播放失败:', err);
    }
  };
  
  // 切换播放/暂停
  const togglePlay = async () => {
    if (!player.value) return;
    
    try {
      await player.value.togglePlay();
    } catch (err: any) {
      error.value = '切换播放状态失败: ' + err.message;
    }
  };
  
  // 暂停
  const pause = async () => {
    if (!player.value) return;
    
    try {
      await player.value.pause();
    } catch (err: any) {
      error.value = '暂停失败: ' + err.message;
    }
  };
  
  // 继续播放
  const resume = async () => {
    if (!player.value) return;
    
    try {
      await player.value.resume();
    } catch (err: any) {
      error.value = '继续播放失败: ' + err.message;
    }
  };
  
  // 下一首
  const next = async () => {
    if (!player.value) return;
    
    try {
      await player.value.nextTrack();
    } catch (err: any) {
      error.value = '下一首失败: ' + err.message;
    }
  };
  
  // 上一首
  const previous = async () => {
    if (!player.value) return;
    
    try {
      await player.value.previousTrack();
    } catch (err: any) {
      error.value = '上一首失败: ' + err.message;
    }
  };
  
  // 跳转到特定位置
  const seek = async (positionMs: number) => {
    if (!player.value) return;
    
    try {
      await player.value.seek(positionMs);
    } catch (err: any) {
      error.value = '跳转失败: ' + err.message;
    }
  };
  
  // 设置音量
  const setVolume = async (volumePercent: number) => {
    if (!player.value) return;
    
    try {
      // 音量范围是0到1
      await player.value.setVolume(volumePercent / 100);
    } catch (err: any) {
      error.value = '设置音量失败: ' + err.message;
    }
  };
  
  // 请求锁定标志，防止短时间内重复请求
  const shuffleRequestLock = ref(false);
  const repeatModeRequestLock = ref(false);
  
  // 设置随机播放
  const setShuffle = async (state: boolean) => {
    // 如果设备ID不存在或者请求锁定中，不执行请求
    if (!deviceId.value) {
      console.warn('⚠️ 设备ID不存在，无法设置随机播放状态');
      return false;
    }
    
    // 检查当前状态是否已经是目标状态
    const currentState = await getCurrentState();
    if (currentState && currentState.shuffle === state) {
      console.log(`✅ 随机播放状态已经是${state ? '开启' : '关闭'}，无需重复设置`);
      
      // 强制更新本地状态，确保UI一致
      if (state) {
        playMode.value = 2;
      } else if (playMode.value === 2) {
        playMode.value = 0;
      }
      
      // 设置手动模式标记
      isManualModeChange.value = true;
      return true;
    }
    
    // 如果请求锁定中，不执行请求
    if (shuffleRequestLock.value) {
      console.log('⚠️ 随机播放请求锁定中，跳过请求');
      return false;
    }
    
    // 锁定请求
    shuffleRequestLock.value = true;
    
    try {
      console.log(`🔀 设置随机播放状态为: ${state ? '开启' : '关闭'}`);
      const token = await getAccessToken();
      
      // 使用Spotify Web API的shuffle接口
      const response = await fetch(`https://api.spotify.com/v1/me/player/shuffle?state=${state}&device_id=${deviceId.value}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // 处理响应
      if (response.status === 204) {
        console.log('✅ 随机播放状态设置成功:', state ? '开启' : '关闭');
        
        // 强制更新本地状态
        if (state) {
          playMode.value = 2; // 设置为随机播放模式
        } else if (playMode.value === 2) {
          // 如果当前是随机播放模式，关闭随机播放后默认设为列表循环
          playMode.value = 0;
        }
        
        // 设置手动模式标记，防止被远程状态覆盖
        isManualModeChange.value = true;
        
        // 解锁请求（延迟解锁，避免短时间内重复请求）
        setTimeout(() => {
          shuffleRequestLock.value = false;
        }, 2000);
        
        return true;
      } else if (response.status === 429) {
        // 请求过多，需要限流
        console.warn('⚠️ API请求过于频繁，稍后重试...');
        
        // 获取重试间隔
        const retryAfter = response.headers.get('Retry-After');
        const retryMs = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
        
        // 延迟解锁
        setTimeout(() => {
          shuffleRequestLock.value = false;
        }, retryMs);
        
        return false;
      } else {
        // 其他错误
        const errorText = await response.text();
        throw new Error(`设置随机播放失败 (${response.status}): ${errorText}`);
      }
    } catch (err: any) {
      console.error('设置随机播放失败:', err);
      
      // 只有非429错误才显示给用户
      if (!err.message.includes('429')) {
        error.value = '设置随机播放失败: ' + err.message;
      }
      
      // 解锁请求（延迟解锁，避免短时间内重复请求）
      setTimeout(() => {
        shuffleRequestLock.value = false;
      }, 3000);
      
      return false;
    }
  };
  
  // 设置重复模式
  const setRepeatMode = async (state: 'off' | 'track' | 'context') => {
    // 如果设备ID不存在或者请求锁定中，不执行请求
    if (!deviceId.value) {
      console.warn('⚠️ 设备ID不存在，无法设置重复模式');
      return false;
    }
    
    // 检查当前状态是否已经是目标状态
    const currentState = await getCurrentState();
    if (currentState) {
      const expectedRepeatMode = state === 'track' ? 1 : (state === 'context' ? 2 : 0);
      if (currentState.repeat_mode === expectedRepeatMode) {
        console.log(`✅ 重复模式已经是${state}，无需重复设置`);
        
        // 确保状态同步
        if (state === 'track' && playMode.value !== 1) {
          playMode.value = 1;
        } else if (state === 'context' && playMode.value !== 0) {
          playMode.value = 0;
        } else if (state === 'off' && playMode.value !== 0 && playMode.value !== 2) {
          // 如果当前不是随机播放模式，则设置为列表循环
          if (playMode.value !== 2) {
            playMode.value = 0;
          }
        }
        
        // 设置手动模式标记
        isManualModeChange.value = true;
        return true;
      }
    }
    
    // 如果请求锁定中，不执行请求
    if (repeatModeRequestLock.value) {
      console.log('⚠️ 重复模式请求锁定中，跳过请求');
      return false;
    }
    
    // 锁定请求
    repeatModeRequestLock.value = true;
    
    try {
      console.log(`🔁 设置重复模式为: ${state}`);
      const token = await getAccessToken();
      
      // 使用Spotify Web API的repeat接口
      const response = await fetch(`https://api.spotify.com/v1/me/player/repeat?state=${state}&device_id=${deviceId.value}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // 处理响应
      if (response.status === 204) {
        console.log('✅ 重复模式已设置为:', state);
        
        // 确保状态同步
        if (state === 'track' && playMode.value !== 1) {
          console.log('强制同步单曲循环模式状态');
          playMode.value = 1;
        } else if (state === 'context' && playMode.value !== 0) {
          console.log('强制同步列表循环模式状态');
          playMode.value = 0;
        } else if (state === 'off' && playMode.value !== 0 && playMode.value !== 2) {
          console.log('重复模式已关闭');
          // 如果当前不是随机播放模式，则设置为列表循环
          if (playMode.value !== 2) {
            playMode.value = 0;
          }
        }
        
        // 设置手动模式标记，防止被远程状态覆盖
        isManualModeChange.value = true;
        
        // 解锁请求（延迟解锁，避免短时间内重复请求）
        setTimeout(() => {
          repeatModeRequestLock.value = false;
        }, 2000);
        
        return true;
      } else if (response.status === 429) {
        // 请求过多，需要限流
        console.warn('⚠️ API请求过于频繁，稍后重试...');
        
        // 获取重试间隔
        const retryAfter = response.headers.get('Retry-After');
        const retryMs = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
        
        // 延迟解锁
        setTimeout(() => {
          repeatModeRequestLock.value = false;
        }, retryMs);
        
        return false;
      } else {
        // 其他错误
        const errorText = await response.text();
        throw new Error(`设置重复模式失败 (${response.status}): ${errorText}`);
      }
    } catch (err: any) {
      console.error('设置重复模式失败:', err);
      
      // 只有非429错误才显示给用户
      if (!err.message.includes('429')) {
        error.value = '设置重复模式失败: ' + err.message;
      }
      
      // 解锁请求（延迟解锁，避免短时间内重复请求）
      setTimeout(() => {
        repeatModeRequestLock.value = false;
      }, 3000);
      
      return false;
    }
  };
  
  // 播放模式切换防抖
  let playModeToggleTimeout: number | null = null;
  // 播放模式切换锁定
  const playModeToggleLock = ref(false);
  // 手动模式切换标记定时器
  let manualModeChangeTimeout: number | null = null;

  // 切换播放模式
  const togglePlayMode = async () => {
    // 如果正在切换模式，直接返回
    if (playModeToggleLock.value) {
      console.log('⚠️ 播放模式切换中，请稍候再试');
      message.warning('播放模式切换中，请稍候再试');
      return;
    }
    
    // 清除之前的防抖定时器
    if (playModeToggleTimeout) {
      clearTimeout(playModeToggleTimeout);
    }
    
    // 清除之前的手动切换标记定时器
    if (manualModeChangeTimeout) {
      clearTimeout(manualModeChangeTimeout);
    }
    
    const newMode = (playMode.value + 1) % 3;
    const oldMode = playMode.value;
    playMode.value = newMode;
    
    // 设置手动切换标记，防止Spotify状态同步覆盖
    isManualModeChange.value = true;
    
    console.log(`🎵 手动切换播放模式: ${oldMode} -> ${newMode} (${playModeInfo.value.name})`);
    
    // 锁定模式切换
    playModeToggleLock.value = true;
    
    // 使用防抖，避免快速切换时发送过多API请求
    playModeToggleTimeout = window.setTimeout(async () => {
      try {
        console.log('⏳ 开始应用播放模式:', playModeInfo.value.name);
        
        // 获取当前状态
        const currentState = await getCurrentState();
        if (!currentState) {
          console.error('❌ 无法获取当前播放状态，切换播放模式失败');
          message.error('获取播放状态失败，请稍后重试');
          return;
        }
        
        console.log(`📊 当前播放状态: repeat_mode=${currentState.repeat_mode}, shuffle=${currentState.shuffle}`);
        
        // 根据新模式设置Spotify播放器状态
        switch (newMode) {
          case 0: // 列表循环
            console.log('🔁 切换到列表循环模式');
            
            if (currentState.shuffle) {
              // 如果当前是随机播放模式，直接设置为列表循环
              console.log('🔄 设置重复模式为context');
              const success = await setRepeatMode('context');
              
              if (!success) {
                console.error('❌ 设置列表循环模式失败');
                message.error('设置列表循环模式失败');
                return;
              }
              
              // 只在设置循环模式成功后关闭随机播放
              console.log('🔄 关闭随机播放');
              const shuffleSuccess = await setShuffle(false);
              
              if (!shuffleSuccess) {
                console.warn('⚠️ 关闭随机播放失败，但列表循环已设置');
              }
            } else {
              // 如果当前不是随机播放，直接设置重复模式
              if (currentState.repeat_mode !== 2) { // 2表示context模式
                console.log('🔄 设置重复模式为context');
                const success = await setRepeatMode('context');
                
                if (!success) {
                  console.error('❌ 设置列表循环模式失败');
                  message.error('设置列表循环模式失败');
                  return;
                }
              } else {
                console.log('✅ 重复模式已经是context，无需设置');
              }
            }
            break;
            
          case 1: // 单曲循环
            console.log('🔂 切换到单曲循环模式');
            
            // 对于单曲循环，优先直接设置重复模式
            console.log('🔄 设置重复模式为track');
            const success = await setRepeatMode('track');
            
            if (!success) {
              console.error('❌ 设置单曲循环模式失败');
              message.error('设置单曲循环模式失败');
              return;
            }
            
            // 只有在当前是随机播放模式时才关闭随机播放
            if (currentState.shuffle) {
              console.log('🔄 关闭随机播放');
              const shuffleSuccess = await setShuffle(false);
              
              if (!shuffleSuccess) {
                console.warn('⚠️ 关闭随机播放失败，但单曲循环已设置');
              }
            }
            break;
            
          case 2: // 随机播放
            console.log('🔀 切换到随机播放模式');
            
            // 对于随机播放，优先设置随机播放状态
            if (!currentState.shuffle) {
              console.log('🔄 开启随机播放');
              const shuffleSuccess = await setShuffle(true);
              
              if (!shuffleSuccess) {
                console.error('❌ 设置随机播放模式失败');
                message.error('设置随机播放模式失败');
                return;
              }
            } else {
              console.log('✅ 随机播放已经开启，无需设置');
            }
            
            // 只有当前是单曲循环时，才更改为列表循环
            if (currentState.repeat_mode === 1) { // 1表示track模式
              console.log('🔄 设置重复模式为context');
              await setRepeatMode('context');
              // 这里不检查失败，因为随机播放已经设置成功
            }
            break;
        }
        
        // 记录最终的播放模式设置结果
        const finalState = await getCurrentState();
        if (finalState) {
          console.log(`✅ 播放模式设置完成，最终状态: repeat_mode=${finalState.repeat_mode}, shuffle=${finalState.shuffle}`);
        }
        
        // 永久保持用户设置的播放模式
        refreshManualModeChange();
        
        console.log('✅ 播放模式切换完成:', playModeInfo.value.name);
      } catch (err: any) {
        console.error('设置播放模式失败:', err);
        message.error(`设置播放模式失败: ${err.message}`);
      } finally {
        // 解锁模式切换（延迟解锁，避免短时间内重复切换）
        setTimeout(() => {
          playModeToggleLock.value = false;
        }, 2000);
      }
    }, 300); // 300ms防抖延迟
  };
  
  // 获取当前状态
  const getCurrentState = async () => {
    if (!player.value) return null;
    
    try {
      const state = await player.value.getCurrentState();
      currentState.value = state;
      
      if (state) {
        currentTrack.value = state.track_window.current_track;
        isPlaying.value = !state.paused;
        position.value = state.position;
        duration.value = state.duration;
        
        // 同步播放模式状态
        syncPlayModeFromSpotifyState(state);
      }
      
      return state;
    } catch (err: any) {
      console.error('获取播放状态失败:', err);
      return null;
    }
  };
  
  // 定期更新播放状态
  let stateUpdateInterval: number | null = null;
  
  const startStateUpdates = () => {
    if (stateUpdateInterval) return;
    
    stateUpdateInterval = window.setInterval(async () => {
      await getCurrentState();
    }, 1000);
  };
  
  const stopStateUpdates = () => {
    if (stateUpdateInterval) {
      clearInterval(stateUpdateInterval);
      stateUpdateInterval = null;
    }
  };
  
  // 重新初始化播放器（用于重试）
  const reinitializePlayer = async () => {
    console.log('🔄 开始重新初始化播放器...');
    error.value = null;
    
    if (player.value) {
      try {
        console.log('⏳ 断开现有播放器连接...');
        await player.value.disconnect();
        console.log('✅ 播放器连接已断开');
      } catch (err) {
        console.error('❌ 断开连接失败:', err);
      }
    }
    
    // 重置所有状态
    player.value = null;
    isReady.value = false;
    isConnected.value = false;
    deviceId.value = '';
    currentState.value = null;
    currentTrack.value = null;
    isPlaying.value = false;
    position.value = 0;
    duration.value = 0;
    
    // 重置播放模式相关状态
    playMode.value = 0;
    isManualModeChange.value = false;
    
    // 清理定时器
    if (playModeToggleTimeout) {
      clearTimeout(playModeToggleTimeout);
      playModeToggleTimeout = null;
    }
    if (playModeToggleLock.value) {
      // 只重置状态，不清除定时器
      playModeToggleLock.value = false;
    }
    
    console.log('🧹 播放器状态已重置');
    
    // 等待一点时间再重新初始化
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await initPlayer();
  };
  
  // 组件挂载时初始化
  onMounted(() => {
    initPlayer();
  });
  
  // 组件卸载时清理
  onUnmounted(() => {
    stopStateUpdates();
    
    // 清理播放模式切换的防抖定时器
    if (playModeToggleTimeout) {
      clearTimeout(playModeToggleTimeout);
      playModeToggleTimeout = null;
    }
    
    // 清理手动切换标记定时器
    if (manualModeChangeTimeout) {
      clearTimeout(manualModeChangeTimeout);
      manualModeChangeTimeout = null;
    }
    
    // 重置播放模式锁定状态
    playModeToggleLock.value = false;
    
    if (player.value) {
      player.value.disconnect();
    }
  });
  
  // 强制重置播放器（清除所有状态）
  const forceResetPlayer = async () => {
    console.log('🚨 强制重置播放器...');
    
    // 停止状态更新
    stopStateUpdates();
    
    // 清除播放器
    if (player.value) {
      try {
        await player.value.disconnect();
      } catch (err) {
        console.error('强制断开连接时出错:', err);
      }
      player.value = null;
    }
    
    // 重置所有状态
    isReady.value = false;
    isConnected.value = false;
    isPremium.value = false;
    deviceId.value = '';
    currentState.value = null;
    currentTrack.value = null;
    isPlaying.value = false;
    position.value = 0;
    duration.value = 0;
    error.value = null;
    
    // 重置播放模式相关状态
    playMode.value = 0;
    isManualModeChange.value = false;
    playModeToggleLock.value = false;
    
    // 清理定时器
    if (playModeToggleTimeout) {
      clearTimeout(playModeToggleTimeout);
      playModeToggleTimeout = null;
    }
    if (manualModeChangeTimeout) {
      clearTimeout(manualModeChangeTimeout);
      manualModeChangeTimeout = null;
    }
    
    console.log('🧹 播放器已完全重置');
  };
  
  function refreshManualModeChange() {
    isManualModeChange.value = true;
    if (manualModeChangeTimeout) clearTimeout(manualModeChangeTimeout);
    console.log('✅ 已永久保持用户设置的播放模式:', playModeInfo.value.name);
  }
  
  // 添加resetManualModeChange函数
  function resetManualModeChange() {
    isManualModeChange.value = false;
    console.log('🔄 已重置播放模式手动标记，允许从Spotify同步');
    
    // 立即同步一次当前状态
    getCurrentState().then(state => {
      if (state) {
        console.log('🔄 重置后立即同步播放模式状态');
        syncPlayModeFromSpotifyState(state);
      }
    });
  }
  
  return {
    player,
    deviceId,
    isReady,
    isConnected,
    isPremium,
    error,
    currentState,
    currentTrack,
    isPlaying,
    position,
    duration,
    playMode,
    playModeInfo,
    play,
    togglePlay,
    pause,
    resume,
    next,
    previous,
    seek,
    setVolume,
    togglePlayMode,
    setRepeatMode,
    setShuffle,
    getCurrentState,
    startStateUpdates,
    stopStateUpdates,
    reinitializePlayer,
    forceResetPlayer,
    checkPremiumStatus,
    validateTokenScopes,
    refreshManualModeChange,
    resetManualModeChange,
  };
} 