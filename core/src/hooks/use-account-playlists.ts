"use client";

import useSWR from "swr";
import { invoke } from "@tauri-apps/api/core";
import { ApplicationResp } from "@/types/application";
import { MusicSource } from "@/types/constants";

export type AccountPlaylist = {
  type: MusicSource;
  content: { id: number; name: string; cover_img_url: string; author: string };
};

export function useAccountPlaylists(source: MusicSource | undefined) {
  return useSWR(source ? ["account-playlists", source] : null, async () => {
    const response = await invoke<ApplicationResp<AccountPlaylist[]>>("collect_list", { source });
    if (response.code !== 0 || !response.data) throw new Error(response.msg || "Could not load playlists");
    return response.data;
  }, { revalidateOnFocus: false });
}
