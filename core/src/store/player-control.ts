import { createStore } from "@udecode/zustood";
import { SongInfo } from "@/types/song.ts";

type PlayerControl = {
  // 播放列表中的音乐列表
  songs: SongInfo[];
  // 当前播放音乐的下标
  index: number;
  // 播放状态
  isPlaying: boolean;
  // 插播的音乐
  immediately: SongInfo | undefined;
};

const playerControl = createStore("play-control")<PlayerControl>({
  songs: [],
  index: -1,
  isPlaying: false,
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
