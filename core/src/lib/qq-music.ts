import { invoke } from "@tauri-apps/api/core";
import { ApplicationResp } from "@/types/application";
import { QqSong } from "@/hooks/use-qq-playback";

export type QqPlaylist = { id: string; name: string; pic_url: string; kind: string };
export type QqPlaylistDetail = { id: string; name: string; pic_url: string; description: string; songs: QqSong[] };

export async function qqUserPlaylists() {
  const response = await invoke<ApplicationResp<{ playlists: QqPlaylist[] }>>("qq_user_playlists");
  if (response.code !== 0 || !response.data) throw new Error(response.msg || "QQ 歌单加载失败");
  return response.data.playlists;
}

export async function qqUserPlaylist(id: string) {
  const response = await invoke<ApplicationResp<QqPlaylistDetail>>("qq_user_playlist", { id });
  if (response.code !== 0 || !response.data) throw new Error(response.msg || "QQ 歌单详情加载失败");
  return response.data;
}
