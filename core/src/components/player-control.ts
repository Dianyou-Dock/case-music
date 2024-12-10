'use client';

import {create} from "zustand";
import {SongInfo} from "@/types/song.ts";
import {invoke} from "@tauri-apps/api/core";
import {ApplicationResp} from "@/types/application.ts";

export interface playerControlData {
  playListInfo: playListInfo,
  songs: SongInfo[];
  current: SongInfo | undefined;
  immediately: SongInfo | undefined;
}

export interface playListInfo {
  type: string;
  list_id: number;
  page_index: number;
  limit: number;
}


export const playerControl = create(
    ()=>({
        data: {} as playerControlData
    }),
)

export async function updateState(result: any) {

  const data = result as playerControlData;
  console.log("updateState: ", data)


  // handle immediately
  if (data.immediately !== undefined) {
    console.log("immediately: ", data.immediately)
    let cur = structuredClone(data.songs[0]);
    const res: playerControlData = {
      current: cur,
      playListInfo: data.playListInfo,
      songs: data.songs,
      immediately: undefined
    }
    playerControl.setState(res as any)
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

  console.log("songs[0]: ", data.songs[0])
  console.log("cur: ", cur);

  const res: playerControlData = {
    current: cur,
    playListInfo: data.playListInfo,
    songs: data.songs,
    immediately: undefined
  }

  playerControl.setState(res as any);
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
