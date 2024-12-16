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
  .extendActions((set, get) => ({
    next() {
      if (get.immediately()) {
        set.state((draft) => {
          draft.immediately = undefined;
        });
      }
      const curIndex = get.index();
      const songsLen = get.songs().length;

      if (curIndex === songsLen - 1) {
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
  }));

export default playerControl;
