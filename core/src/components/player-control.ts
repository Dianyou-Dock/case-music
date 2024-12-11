'use client';

import {create} from "zustand";
import {SongInfo} from "@/types/song.ts";
import {invoke} from "@tauri-apps/api/core";
import {ApplicationResp} from "@/types/application.ts";

export interface playListInfo {
  type: string;
  list_id: number;
  page_index: number;
  limit: number;
}


export const playerControl = create(
    ()=>({
      playListInfo: {} as playListInfo,
      songs: [] as SongInfo[],
      current: {} as SongInfo,
      immediately: {} as SongInfo,
    }),
)

export async function updateState(data: any) {


  // handle immediately
  if (data.immediately !== undefined) {
    const cur = structuredClone(data.songs[0]);
    playerControl.setState({
      current: cur,
      playListInfo: data.playListInfo,
      songs: data.songs,
      immediately: undefined
    })
    return
  }

  // 弹出已经播放完的
  data.songs.shift();

  if (data.songs.length <= 5) {
    // update songs
    updateSongs(data.playListInfo).then((res) => {
      if (res) {
        data.songs.push(...res)
      }

    })
  }

  // 给个引用, 因为后续插队歌曲进来播放完后, 这里还需要, 所以给引用
  const cur: SongInfo = {
    type: data.songs[0].type,
    content: data.songs[0].content
  };

  playerControl.setState({
    current: cur,
    playListInfo: data.playListInfo,
    songs: data.songs,
    immediately: undefined
  });
}

async function updateSongs(playListInfo: playListInfo):Promise<SongInfo[] | undefined> {
  const result = await invoke<ApplicationResp<SongInfo[]>>("list_songs", {
    req: {
      source: playListInfo.type,
      list_id: playListInfo.list_id,
      offset: playListInfo.page_index,
      limit: playListInfo.limit
    }
  });

  if (result.data) {
    return result.data as SongInfo[];
  }

  return undefined
}
