import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ApplicationResp, RecommendReq, RecommendSongResp } from "@/types/application";
import { MusicSource } from "@/types/constants";
import { PlaylistRes } from "@/types/music";
import { SongInfo } from "@/types/song";

type RecommendationTask = {
  kind: "sample" | "random" | null;
  status: "idle" | "running" | "success" | "error";
  source?: MusicSource;
  song?: string;
  singer?: string;
  songs: SongInfo[];
  coverUrl?: string;
  error?: string;
};

const initialTask: RecommendationTask = { kind: null, status: "idle", songs: [] };
let task = initialTask;
const listeners = new Set<() => void>();

function setTask(next: RecommendationTask) {
  task = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useRecommendationTask() {
  return useSyncExternalStore(subscribe, () => task, () => initialTask);
}

function run(
  pending: RecommendationTask,
  work: () => Promise<{ songs: SongInfo[]; coverUrl?: string }>,
) {
  // Set the lock before invoking any async work, so even same-tick clicks are discarded.
  if (task.status === "running") return false;
  setTask({ ...pending, status: "running", songs: [], error: undefined });
  void work().then(
    (result) => setTask({ ...pending, ...result, status: "success", error: undefined }),
    (cause) => setTask({
      ...pending,
      status: "error",
      songs: [],
      error: cause instanceof Error ? cause.message : String(cause),
    }),
  );
  return true;
}

export function startSampleRecommendation(source: MusicSource, song: string, singer: string) {
  return run({ kind: "sample", status: "idle", source, song, singer, songs: [] }, async () => {
    const req: RecommendReq = {
      source, song, singer, recommend_song_count: 15, recommend_singer_count: 0,
    };
    const response = await invoke<ApplicationResp<RecommendSongResp>>("recommend_song", { req });
    if (response.code !== 0 || !response.data) {
      throw new Error(response.msg || "Recommendation failed");
    }
    return { songs: response.data.song_infos };
  });
}

export function startRandomRecommendation(source: MusicSource, refresh = false) {
  return run({ kind: "random", status: "idle", source, songs: [] }, async () => {
    if (refresh) {
      const refreshed = await invoke<ApplicationResp<void>>("refresh_rand_cache", { source });
      if (refreshed.code !== 0) throw new Error(refreshed.msg || "Recommendation failed");
    }
    const response = await invoke<PlaylistRes>("rand_recommends", { source });
    if (response.code !== 0 || !response.data) {
      throw new Error(response.msg || "Recommendation failed");
    }
    return {
      songs: response.data.songs.map((song, index) => ({
        ...song, liked: response.data!.likeds[index] ?? song.liked,
      })),
      coverUrl: response.data.cover_img_url,
    };
  });
}
