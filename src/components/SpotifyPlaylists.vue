<script setup lang="ts">
import { ref, onMounted, defineEmits } from 'vue'
import { NCard, NGrid, NGridItem, NImage, NEmpty, NSpin, useMessage, NButton, NPagination, NSpace } from 'naive-ui'
import { invoke } from "@tauri-apps/api/core"
import useTheme from '../composables/useTheme'
import usePlayer from '../composables/usePlayer'
import PlaylistItems from './PlaylistItems.vue'

const { themeColor, isDarkTheme } = useTheme()
const message = useMessage()
const loading = ref(true)
const playlists = ref<any[]>([])


// 视图状态控制
const currentView = ref<'list' | 'items'>('list')
const currentPlaylistId = ref('')
const currentPlaylistName = ref('')

// 分页相关
const currentPage = ref(1)
const pageSize = ref(20)
const totalItems = ref(0)

// 用户ID相关
const isUserPlaylists = ref(false)

// 播放器
const { playTrack } = usePlayer()

const emit = defineEmits(['play-track'])

const fetchPlaylists = async (page = 1) => {
  loading.value = true
  try {
    // 计算偏移量
    const offset = (page - 1) * pageSize.value
    
    // 根据是否获取用户歌单选择不同的API
    const apiName = isUserPlaylists.value ? 'get_user_spotify_playlists' : 'get_spotify_playlists'
    const params = isUserPlaylists.value 
      ? { limit: pageSize.value, offset } 
      : { limit: pageSize.value, offset }
    
    const response = await invoke(apiName, params) as {
      success: boolean
      message: string
      playlists?: any[]
      total?: number
      limit?: number
      offset?: number
      next?: string
      previous?: string
    }

    if (response.success && response.playlists) {
      playlists.value = response.playlists
      if (response.total) {
        totalItems.value = response.total
      }
      currentPage.value = page
    } else {
      message.error(response.message || '获取歌单失败')
    }
  } catch (error: any) {
    message.error(`获取歌单出错: ${error.message || error}`)
  } finally {
    loading.value = false
  }
}



const handlePlaylistClick = (playlist: any) => {
  currentPlaylistId.value = playlist.id
  currentPlaylistName.value = playlist.name
  currentView.value = 'items'
}



const handleBackToPlaylists = () => {
  currentView.value = 'list'
  currentPlaylistId.value = ''
  currentPlaylistName.value = ''
}

const handlePlayTrack = (uri: string) => {
  emit('play-track', uri)
}

const handlePageChange = (page: number) => {
  fetchPlaylists(page)
}

const searchUserPlaylists = () => {
  isUserPlaylists.value = true
  currentPage.value = 1
  fetchPlaylists(1)
}

const showMyPlaylists = () => {
  isUserPlaylists.value = false
  currentPage.value = 1
  fetchPlaylists(1)
}



onMounted(() => {
  fetchPlaylists()
})
</script>

  <template>
    <div class="playlists-container">
      <!-- 歌单列表视图 -->
      <div v-if="currentView === 'list'" class="playlists-view">
        <n-spin :show="loading">
          <div v-if="playlists.length > 0" class="playlists-grid">
            <n-grid :cols="4" :x-gap="16" :y-gap="16">
              <n-grid-item v-for="playlist in playlists" :key="playlist.id">
                <n-card
                  class="playlist-card"
                  :title="playlist.name"
                  :bordered="false"
                  size="small"
                  hoverable
                  @click="handlePlaylistClick(playlist)"
                >
                  <template #cover>
                    <n-image
                      v-if="playlist.images && Array.isArray(playlist.images) && playlist.images.length > 0"
                      :src="playlist.images[0].url"
                      object-fit="cover"
                      class="playlist-image"
                      :preview-disabled="true"
                    />
                    <div v-else class="no-image">
                      <span>无封面</span>
                    </div>
                  </template>
                  
                  <div class="playlist-info">
                    <p class="playlist-desc" v-if="playlist.description">{{ playlist.description }}</p>
                    <p class="playlist-tracks">{{ playlist.tracks.total }} 首歌曲</p>
                    <p class="playlist-owner">
                      创建者: {{ playlist.owner.display_name || playlist.owner.id }}
                    </p>
                  </div>
                </n-card>
              </n-grid-item>
            </n-grid>
            
            <!-- 分页控件 -->
            <div class="pagination-container" v-if="totalItems > pageSize">
              <n-pagination 
                v-model:page="currentPage"
                :page-count="Math.ceil(totalItems / pageSize)"
                :on-update:page="handlePageChange"
              />
            </div>
          </div>
          
          <n-empty v-else-if="!loading" description="没有找到歌单" />
        </n-spin>
      </div>

      <!-- 播放列表歌曲视图 -->
      <div v-else-if="currentView === 'items'" class="playlist-items-view">
        <PlaylistItems
          :playlist-id="currentPlaylistId"
          :playlist-name="currentPlaylistName"
          @play-track="handlePlayTrack"
        />
      </div>
  </div>
</template>

<style scoped>
.playlists-container {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.playlists-view {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.playlist-items-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.playlists-grid {
  margin-top: 20px;
  flex: 1;
}

.playlist-card {
  transition: transform 0.2s;
  height: 100%;
  cursor: pointer;
}

.playlist-card:hover {
  transform: translateY(-5px);
}

.playlist-image {
  height: 180px;
  width: 100%;
  object-fit: cover;
}

.no-image {
  height: 180px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: v-bind("isDarkTheme ? '#282828' : '#e0e0e0'");
  color: v-bind(themeColor);
}

.playlist-info {
  padding: 8px 0;
}

.playlist-desc {
  font-size: 14px;
  color: v-bind("isDarkTheme ? '#aaaaaa' : '#666666'");
  margin: 5px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.playlist-tracks {
  font-size: 14px;
  color: v-bind(themeColor);
  margin: 5px 0;
}

.playlist-owner {
  font-size: 12px;
  color: v-bind("isDarkTheme ? '#888888' : '#999999'");
  margin: 5px 0;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}


</style> 