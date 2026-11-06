import { createStore } from "@udecode/zustood";
import { SongInfo } from "@/types/song.ts";

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

      if (get.index() === 0) {
        return new Error("Already at the first song");
      }

      set.state((draft) => {
        draft.index = draft.index - 1;
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
      const curIndex = get.index();

      if (get.isLastSong()) {
        return new Error("Already at the last song");
      }

      const nextIndex = curIndex + 1;

      set.state((draft) => {
        draft.index = nextIndex;
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
