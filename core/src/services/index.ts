"use client";

import { invoke } from "@tauri-apps/api/core";
import { ApplicationResp } from "@/types/application";
import { PlayListInfo } from "@/types/application";
import { ListSongResp } from "@/types/application";

export const likeSong = async ({
  source,
  song_id,
  is_like,
}: {
  source: string;
  song_id: number;
  is_like: boolean;
}) => {
  return invoke<ApplicationResp<boolean>>("like_song", {
    req: {
      source,
      song_id,
      is_like,
    },
  });
};

export const updateSongs = async (
  playListInfo: PlayListInfo
): Promise<ListSongResp | undefined> => {
  const result = await invoke<ApplicationResp<ListSongResp>>("list_songs", {
    req: {
      source: playListInfo.type,
      list_id: playListInfo.list_id,
      offset: playListInfo.page_index,
      limit: playListInfo.limit,
    },
  });

  return result.data;
};
