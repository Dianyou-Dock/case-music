import { createStore } from "@udecode/zustood";
import { SongInfo } from "@/types/song.ts";
import { PlayListInfo } from "@/types/application";
import { updateSongs } from "@/services";

type PlayerControl = {
  // 播放列表信息
  playListInfo: PlayListInfo;
  // 播放列表中的音乐列表
  songs: SongInfo[];
  // 当前播放音乐的下标
  index: number;
  // 当前播放的音乐
  current: SongInfo | undefined;
  // 插队播放的音乐
  immediately: SongInfo | undefined;
  // 列表音乐总数量
  total: number;
  // 列表音乐是否喜欢的参考数据
  likeds: boolean[];
  // 当前音乐是否被 like
  thisLiked: boolean;
};

const playerControl = createStore("play-control")<PlayerControl>({
  playListInfo: {} as PlayListInfo,
  songs: [] as SongInfo[],
  index: -1,
  current: undefined,
  immediately: undefined,
  total: -1,
  likeds: [] as boolean[],
  thisLiked: false,
})
  .extendActions((set, get) => ({
    back() {
      if (get.index() === 0) {
        return new Error("Already at the first song");
      }

      const backIndex = get.index() - 1;
      const song = get.songs()[backIndex];
      const thisLiked = get.likeds()[backIndex];

      const cur: SongInfo = {
        type: song.type,
        content: song.content,
      };

      set.state((draft) => {
        draft.current = cur;
        draft.index = backIndex;
        draft.immediately = undefined;
        draft.thisLiked = thisLiked;
      });
    },
  }))
  .extendActions((set, get) => ({
    next() {
      const songsLen = get.songs().length;

      if (songsLen - get.index() <= 5) {
        if (get.total() - songsLen > 0) {
          const offset = get.playListInfo().page_index + 1;
          const limit = get.playListInfo().limit;

          const req: PlayListInfo = {
            type: get.playListInfo().type,
            list_id: get.playListInfo().list_id,
            page_index: offset,
            limit: limit,
          };

          updateSongs(req).then((res) => {
            if (res) {
              set.state((draft) => {
                draft.songs.push(...res.list);
                draft.likeds.push(...res.likeds);
              });
            }
          });
        } else {
          return new Error("Already at the last song");
        }
      }

      const nextIndex = get.index() + 1;
      const song = get.songs()[nextIndex];
      const thisLiked = get.likeds()[nextIndex];

      const cur: SongInfo = {
        type: song.type,
        content: song.content,
      };

      set.state((draft) => {
        draft.current = cur;
        draft.index = nextIndex;
        draft.immediately = undefined;
        draft.thisLiked = thisLiked;
      });
    },
  }));

export default playerControl;
