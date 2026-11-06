import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ApplicationResp, RecommendReq, RecommendSongResp } from "@/types/application";
import { MusicSource } from "@/types/constants";
import { PlaylistRes } from "@/types/music";
import { SongInfo } from "@/types/song";
import { SpotifyTrack } from "@/types/spotify-track";
import type { QqSong } from "@/hooks/use-qq-playback";
import { getRecommendationFeedback, getSourceRecommendationFeedback } from "@/lib/recommendation-feedback";

export type RecommendationTask = {
  runId?: string;
  kind: "sample" | "random" | null;
  status: "idle" | "running" | "success" | "error";
  source?: MusicSource;
  song?: string;
  singer?: string;
  seedTrackId?: string;
  songs: SongInfo[];
  spotifySongs?: SpotifyTrack[];
  qqSongs?: QqSong[];
  coverUrl?: string;
  error?: string;
};

export type RecommendationRecord = {
  id: string;
  runId?: string;
  completedAt: number;
  kind: "sample" | "random";
  source: MusicSource;
  song?: string;
  singer?: string;
  seedTrackId?: string;
  songs: SongInfo[];
  spotifySongs?: SpotifyTrack[];
  qqSongs?: QqSong[];
  coverUrl?: string;
};

type RecommendationState = {
  hydrated: boolean;
  task: RecommendationTask;
  history: RecommendationRecord[];
};

const storageKey = "case-music:recommendation-history:v1";
export const showCurrentRecommendationEvent = "case-music:show-current-recommendation";
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

export function getRecommendationState() {
  hydrateRecommendationState();
  return state;
}

function run(
  pending: RecommendationTask & { kind: "sample" | "random"; source: MusicSource },
  work: () => Promise<{ songs: SongInfo[]; spotifySongs?: SpotifyTrack[]; qqSongs?: QqSong[]; coverUrl?: string }>,
) {
  hydrateRecommendationState();
  // Take the lock synchronously; requests made while this one runs are discarded.
  if (state.task.status === "running") return null;
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  setState({ ...state, task: { ...pending, runId, status: "running", songs: [], error: undefined } });
  persist();
  void work().then(
    (result) => {
      const completedAt = Date.now();
      const task: RecommendationTask = { ...pending, ...result, runId, status: "success", error: undefined };
      const record: RecommendationRecord = {
        id: `${completedAt}-${Math.random().toString(36).slice(2)}`,
        runId,
        completedAt,
        kind: pending.kind,
        source: pending.source,
        song: pending.song,
        singer: pending.singer,
        seedTrackId: pending.seedTrackId,
        songs: result.songs,
        spotifySongs: result.spotifySongs,
        qqSongs: result.qqSongs,
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
          runId,
          status: "error",
          songs: [],
          error: cause instanceof Error ? cause.message : String(cause),
        },
      });
      persist();
    },
  );
  return runId;
}

function recentTracks(source: MusicSource, limit = 60) {
  hydrateRecommendationState();
  const ids = new Set<string>();
  const songs: { id: string; name: string; singer: string }[] = [];
  for (const record of state.history) {
    if (record.source !== source) continue;
    const tracks = source === "Spotify"
      ? (record.spotifySongs ?? []).map((track) => ({ id: track.id, name: track.name, singer: track.artists[0]?.name ?? "" }))
      : record.songs.map((song) => ({ id: String(song.content.id), name: song.content.name, singer: song.content.singer }));
    for (const track of tracks) {
      if (!track.id || ids.has(track.id)) continue;
      ids.add(track.id);
      songs.push(track);
      if (songs.length >= limit) return songs;
    }
  }
  return songs;
}

export function startSampleRecommendation(source: MusicSource, song: string, singer: string, spotifyTrackId?: string) {
  return run({ kind: "sample", status: "idle", source, song, singer, seedTrackId: spotifyTrackId, songs: [] }, async () => {
    if (source === "Spotify") {
      if (!spotifyTrackId) throw new Error("Spotify track ID is required");
      const excludedTrackIds = [...new Set([...getSourceRecommendationFeedback("Spotify").skipped, ...recentTracks("Spotify").map((track) => track.id)])].slice(0, 160);
      const response = await invoke<ApplicationResp<SpotifyTrack[]>>("spotify_random_recommendations", { seedTrackId: spotifyTrackId, excludedTrackIds });
      if (response.code !== 0 || !response.data) throw new Error(response.msg || "Recommendation failed");
      return { songs: [], spotifySongs: response.data };
    }
    const req: RecommendReq = {
      source, song, singer, recommend_song_count: 15, recommend_singer_count: 0,
      previous: recentTracks(source, 30).map(({ name, singer }) => ({ name, singer, song_type: "" })),
      excluded_song_ids: recentTracks(source, 60).map((track) => Number(track.id)).filter(Number.isFinite),
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
    if (source === "QQ") {
      const response = await invoke<ApplicationResp<QqSong[]>>("qq_random_recommendations");
      if (response.code !== 0 || !response.data) throw new Error(response.msg || "QQ 音乐推荐失败");
      return { songs: [], qqSongs: response.data, coverUrl: response.data[0]?.pic_url };
    }
    if (source === "Spotify") {
      const excludedTrackIds = [...new Set([...getSourceRecommendationFeedback("Spotify").skipped, ...recentTracks("Spotify").map((track) => track.id)])].slice(0, 160);
      const response = await invoke<ApplicationResp<SpotifyTrack[]>>("spotify_random_recommendations", { seedTrackId: null, excludedTrackIds });
      if (response.code !== 0 || !response.data) throw new Error(response.msg || "Recommendation failed");
      return { songs: [], spotifySongs: response.data };
    }
    const feedback = {
      ...getRecommendationFeedback(),
      recently_recommended: recentTracks(source, 30).map(({ name, singer }) => ({ name, singer, song_type: "" })),
      excluded_song_ids: recentTracks(source, 60).map((track) => Number(track.id)).filter(Number.isFinite),
    };
    if (refresh) {
      const refreshed = await invoke<ApplicationResp<void>>("refresh_rand_cache", { source, feedback });
      if (refreshed.code !== 0) throw new Error(refreshed.msg || "Recommendation failed");
    }
    const response = await invoke<PlaylistRes>("rand_recommends", { source, feedback });
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
