import { createStore } from "@udecode/zustood";
import { SongInfo } from "@/types/song.ts";
import { getPlaybackMode, nextQueueIndex, previousQueueIndex } from "@/store/playback-mode";

type PlayerControl = {
  // 播放列表中的音乐列表
  songs: SongInfo[];
  // 当前播放音乐的下标
  index: number;
  // 播放状态
  isPlaying: boolean;
  progress: number;
  duration: number;
  seekRequest: { position: number; id: number } | null;
  restartKey: number;
  // 插播的音乐
  immediately: SongInfo | undefined;
};

const playerControl = createStore("play-control")<PlayerControl>({
  songs: [],
  index: -1,
  isPlaying: false,
  progress: 0,
  duration: 0,
  seekRequest: null,
  restartKey: 0,
  immediately: undefined,
})
  .extendSelectors((_, get) => ({
    currentSong() {
      if (get.immediately()) {
        return get.immediately();
      }
      return get.songs()[get.index()];
    },
  }))
  .extendActions((set, get) => ({
    back() {
      if (get.immediately()) {
        set.state((draft) => {
          draft.immediately = undefined;
        });
      }

      const previous = previousQueueIndex(get.index(), get.songs().length, getPlaybackMode());
      if (previous < 0) {
        return new Error("Already at the first song");
      }

      set.state((draft) => {
        draft.index = previous;
        draft.restartKey++;
        draft.isPlaying = true;
      });
    },
  }))
  .extendSelectors((_, get) => ({
    isLastSong() {
      return get.index() === get.songs().length - 1;
    },
  }))
  .extendActions((set, get) => ({
    next() {
      if (get.immediately()) {
        set.state((draft) => {
          draft.immediately = undefined;
        });
      }
      const nextIndex = nextQueueIndex(get.index(), get.songs().length, getPlaybackMode());
      if (nextIndex < 0) {
        return new Error("Already at the last song");
      }

      set.state((draft) => {
        draft.index = nextIndex;
        draft.restartKey++;
        draft.isPlaying = true;
      });
    },
  }))
  .extendActions((set) => ({
    play() {
      set.state((draft) => {
        draft.isPlaying = true;
      });
    },
  }))
  .extendActions((set) => ({
    pause() {
      set.state((draft) => {
        draft.isPlaying = false;
      });
    },
  }))
  .extendActions((set) => ({
    seek(position: number) {
      set.state((draft) => {
        draft.progress = position;
        draft.seekRequest = { position, id: (draft.seekRequest?.id ?? 0) + 1 };
      });
    },
  }))
  .extendActions((set) => ({
    select(index: number) {
      set.state((draft) => {
        if (index < 0 || index >= draft.songs.length) return;
        draft.index = index;
        draft.restartKey++;
        draft.immediately = undefined;
        draft.isPlaying = true;
      });
    },
    enqueue(song: SongInfo) {
      set.state((draft) => {
        draft.songs.push(song);
        if (draft.index < 0) draft.index = 0;
      });
    },
    remove(index: number) {
      set.state((draft) => {
        if (index < 0 || index >= draft.songs.length) return;
        draft.songs.splice(index, 1);
        if (draft.songs.length === 0) {
          draft.index = -1;
          draft.immediately = undefined;
          draft.isPlaying = false;
        } else if (index < draft.index) {
          draft.index--;
        } else if (index === draft.index) {
          draft.index = Math.min(index, draft.songs.length - 1);
        }
      });
    },
    clear() {
      set.state((draft) => {
        draft.songs = [];
        draft.index = -1;
        draft.immediately = undefined;
        draft.isPlaying = false;
      });
    },
  }))
  .extendActions((set) => ({
    likeCurrent(isLike: boolean) {
      set.state((draft) => {
        const currentIdx = draft.index;
        draft.songs[currentIdx].liked = isLike
      })
    }
  }))
  .extendActions((set) => ({
    likeImmediately(isLike: boolean) {
      set.state((draft) => {
        if (draft.immediately){
          draft.immediately.liked = isLike
        }
      })
    }
  }));

export default playerControl;
