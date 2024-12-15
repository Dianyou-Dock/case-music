"use client";

import { create } from "zustand";
import { SongInfo } from "@/types/song.ts";
import { invoke } from "@tauri-apps/api/core";
import { ApplicationResp, ListSongResp } from "@/types/application.ts";

export interface playListInfo {
  type: string;
  list_id: number;
  page_index: number;
  limit: number;
}

export const playerControl = create(() => ({
  playListInfo: {} as playListInfo,
  songs: [] as SongInfo[],
  index: -1,
  current: {} as SongInfo,
  immediately: {} as SongInfo,
  total: -1,
  likeds: [] as boolean[],
  thisLiked: false,
}));

export async function updateState(data: any) {
  // handle immediately finish
  if (data.immediately !== undefined) {
    const cur = structuredClone(data.songs[data.index]);
    const thisLiked = data.likeds[data.index];
    playerControl.setState({
      current: cur,
      playListInfo: data.playListInfo,
      songs: data.songs,
      index: data.index,
      immediately: undefined,
      total: data.total,
      likeds: data.liked,
      thisLiked: thisLiked,
    });
    return;
  }

  if (data.songs.length - data.index <= 5) {
    // update songs
    updateSongs(data.playListInfo).then((res) => {
      if (res) {
        data.songs.push(...res.list);
        data.likeds.push(...res.likeds);
      }
    });
  }

  data.index += 1;
  const song = data.songs[data.index];
  const thisLiked = data.likeds[data.index];

  const cur: SongInfo = {
    type: song.type,
    content: song.content,
  };

  playerControl.setState({
    current: cur,
    playListInfo: data.playListInfo,
    index: data.index,
    songs: data.songs,
    immediately: undefined,
    total: data.total,
    likeds: data.liked,
    thisLiked: thisLiked,
  });
}

async function updateSongs(
  playListInfo: playListInfo
): Promise<ListSongResp | undefined> {
  const result = await invoke<ApplicationResp<ListSongResp>>("list_songs", {
    req: {
      source: playListInfo.type,
      list_id: playListInfo.list_id,
      offset: playListInfo.page_index,
      limit: playListInfo.limit,
    },
  });

  return result.data;
}

export async function back() {
  const data = playerControl.getState();

  if (data.index === 0) {
    return new Error("Already at the first song");
  }

  const backIndex = data.index - 1;
  const song = data.songs[backIndex];
  const thisLiked = data.likeds[backIndex];

  const cur: SongInfo = {
    type: song.type,
    content: song.content,
  };

  playerControl.setState({
    current: cur,
    playListInfo: data.playListInfo,
    index: backIndex,
    songs: data.songs,
    immediately: undefined,
    total: data.total,
    likeds: data.likeds,
    thisLiked: thisLiked,
  });
}

export async function next() {
  const data = playerControl.getState();

  const songsLen = data.songs.length;

  if (songsLen - data.index <= 5) {
    if (data.total - songsLen > 0) {
      const offset = data.playListInfo.page_index + 1;
      const limit = data.playListInfo.limit;

      const req: playListInfo = {
        type: data.playListInfo.type,
        list_id: data.playListInfo.list_id,
        page_index: offset,
        limit: limit,
      };

      updateSongs(req).then((res) => {
        if (res) {
          data.songs.push(...res.list);
          data.likeds.push(...res.likeds);
        }
      });
    } else {
      return new Error("Already at the last song");
    }
  }

  const nextIndex = data.index + 1;
  const song = data.songs[nextIndex];
  const thisLiked = data.likeds[nextIndex];

  const cur: SongInfo = {
    type: song.type,
    content: song.content,
  };

  playerControl.setState({
    current: cur,
    playListInfo: data.playListInfo,
    index: nextIndex,
    songs: data.songs,
    immediately: undefined,
    likeds: data.likeds,
    thisLiked: thisLiked,
  });
}
