import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ApplicationResp, RecommendReq, RecommendSongResp } from "@/types/application";
import { MusicSource } from "@/types/constants";
import { PlaylistRes } from "@/types/music";
import { SongInfo } from "@/types/song";

export type RecommendationTask = {
  kind: "sample" | "random" | null;
  status: "idle" | "running" | "success" | "error";
  source?: MusicSource;
  song?: string;
  singer?: string;
  songs: SongInfo[];
  coverUrl?: string;
  error?: string;
};

export type RecommendationRecord = {
  id: string;
  completedAt: number;
  kind: "sample" | "random";
  source: MusicSource;
  song?: string;
  singer?: string;
  songs: SongInfo[];
  coverUrl?: string;
};

type RecommendationState = {
  hydrated: boolean;
  task: RecommendationTask;
  history: RecommendationRecord[];
};

const storageKey = "case-music:recommendation-history:v1";
const initialTask: RecommendationTask = { kind: null, status: "idle", songs: [] };
const initialState: RecommendationState = { hydrated: false, task: initialTask, history: [] };
let state = initialState;
const listeners = new Set<() => void>();

function setState(next: RecommendationState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useRecommendationState() {
  return useSyncExternalStore(subscribe, () => state, () => initialState);
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey, JSON.stringify({ task: state.task, history: state.history }));
  } catch (error) {
    console.warn("Could not save recommendation history", error);
  }
}

export function hydrateRecommendationState() {
  if (state.hydrated || typeof window === "undefined") return;
  let task = initialTask;
  let history: RecommendationRecord[] = [];
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.history)) history = parsed.history;
      if (parsed.task && Array.isArray(parsed.task.songs)) {
        task = parsed.task.status === "running"
          ? { ...parsed.task, status: "error", error: "recommend_interrupted" }
          : parsed.task;
      }
    }
  } catch (error) {
    console.warn("Could not load recommendation history", error);
  }
  setState({ hydrated: true, task, history });
}

function run(
  pending: RecommendationTask & { kind: "sample" | "random"; source: MusicSource },
  work: () => Promise<{ songs: SongInfo[]; coverUrl?: string }>,
) {
  hydrateRecommendationState();
  // Take the lock synchronously; requests made while this one runs are discarded.
  if (state.task.status === "running") return false;
  setState({ ...state, task: { ...pending, status: "running", songs: [], error: undefined } });
  persist();
  void work().then(
    (result) => {
      const completedAt = Date.now();
      const task: RecommendationTask = { ...pending, ...result, status: "success", error: undefined };
      const record: RecommendationRecord = {
        id: `${completedAt}-${Math.random().toString(36).slice(2)}`,
        completedAt,
        kind: pending.kind,
        source: pending.source,
        song: pending.song,
        singer: pending.singer,
        songs: result.songs,
        coverUrl: result.coverUrl,
      };
      setState({ ...state, task, history: [record, ...state.history] });
      persist();
    },
    (cause) => {
      setState({
        ...state,
        task: {
          ...pending,
          status: "error",
          songs: [],
          error: cause instanceof Error ? cause.message : String(cause),
        },
      });
      persist();
    },
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
