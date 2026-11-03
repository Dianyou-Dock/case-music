import { useEffect, useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MusicSource } from "@/types/constants";
import { PlaylistRes } from "@/types/music";
import { SongInfo } from "@/types/song";

const pageSize = 100;

type LikedState = {
  songs: SongInfo[];
  total: number;
  coverUrl?: string;
  nextPage: number;
  loaded: boolean;
  loading: boolean;
  error?: string;
};

const initialState: LikedState = {
  songs: [], total: 0, nextPage: 0, loaded: false, loading: false,
};
const states = new Map<MusicSource, LikedState>();
const generations = new Map<MusicSource, number>();
const listeners = new Set<() => void>();
const scrollPositions = new Map<MusicSource, number>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getState(source: MusicSource | undefined) {
  return source ? states.get(source) ?? initialState : initialState;
}

function setState(source: MusicSource, next: LikedState) {
  states.set(source, next);
  listeners.forEach((listener) => listener());
}

export function getLikedScroll(source: MusicSource) {
  return scrollPositions.get(source) ?? 0;
}

export function saveLikedScroll(source: MusicSource, top: number) {
  scrollPositions.set(source, top);
}

export async function loadMoreLiked(source: MusicSource) {
  const current = getState(source);
  if (current.loading || (current.loaded && current.songs.length >= current.total)) return;
  const generation = generations.get(source) ?? 0;
  setState(source, { ...current, loading: true, error: undefined });
  try {
    const response = await invoke<PlaylistRes>("like_list", {
      req: { source, offset: current.nextPage, limit: pageSize },
    });
    if (response.code !== 0 || !response.data) {
      throw new Error(response.msg || "Could not load liked songs");
    }
    if (generation !== (generations.get(source) ?? 0)) return;
    const page = response.data;
    const seen = new Set(current.songs.map((song) => song.content.id));
    const songs = [...current.songs];
    for (const song of page.songs) {
      if (!seen.has(song.content.id)) {
        songs.push({ ...song, liked: true });
        seen.add(song.content.id);
      }
    }
    setState(source, {
      songs,
      total: page.songs.length === 0 ? songs.length : page.total,
      coverUrl: page.cover_img_url,
      nextPage: current.nextPage + 1,
      loaded: true,
      loading: false,
    });
  } catch (cause) {
    if (generation !== (generations.get(source) ?? 0)) return;
    setState(source, {
      ...current,
      loading: false,
      error: cause instanceof Error ? cause.message : String(cause),
    });
  }
}

export function refreshLiked(source: MusicSource) {
  generations.set(source, (generations.get(source) ?? 0) + 1);
  setState(source, initialState);
  saveLikedScroll(source, 0);
  return loadMoreLiked(source);
}

export default function useLikedPlaylist(source: MusicSource | undefined) {
  const state = useSyncExternalStore(
    subscribe,
    () => getState(source),
    () => initialState,
  );

  useEffect(() => {
    if (source && !state.loaded && !state.loading && !state.error) {
      void loadMoreLiked(source);
    }
  }, [source, state.loaded, state.loading, state.error]);

  return {
    ...state,
    hasMore: state.loaded && state.songs.length < state.total,
    isLoadingInitial: !state.loaded && state.loading,
  };
}
