"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ApplicationResp } from "@/types/application";
import playerControl from "@/store/player-control";
import { useSpotifyPlayback } from "@/hooks/use-spotify-playback";

export type QqSong = {
  id: string;
  name: string;
  pic_url: string;
  artists: { id: string; name: string }[];
  album: { id: string; name: string };
};

type Playback = {
  song: QqSong | null;
  playing: boolean;
  loading: boolean;
  error: string;
  position: number;
  duration: number;
  play(songs: QqSong[], index: number): Promise<void>;
  toggle(): void;
  seek(position: number): void;
  next(): void;
  previous(): void;
  stop(): void;
};

const Context = createContext<Playback | null>(null);

export function QqPlaybackProvider({ children }: { children: React.ReactNode }) {
  const spotify = useSpotifyPlayback();
  const neteasePlaying = playerControl.useTracked.isPlaying();
  const audio = useRef<HTMLAudioElement>(null);
  const queue = useRef<QqSong[]>([]);
  const requestId = useRef(0);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const song = queue.current[index] ?? null;

  const select = useCallback(async (songs: QqSong[], nextIndex: number) => {
    const nextSong = songs[nextIndex];
    if (!nextSong) return;
    const currentRequest = ++requestId.current;
    queue.current = songs;
    setIndex(nextIndex);
    setLoading(true);
    setError("");
    setPlaying(false);
    setPosition(0);
    setDuration(0);
    audio.current?.pause();
    playerControl.set.pause();
    try {
      if (spotify.active && !spotify.paused) await spotify.toggle();
      const response = await invoke<ApplicationResp<string>>("qq_playback_url", { id: nextSong.id });
      if (!response.data) throw new Error(response.msg || "QQ 音乐未返回可播放链接");
      if (currentRequest !== requestId.current) return;
      const element = audio.current;
      if (!element) return;
      element.src = response.data;
      await element.play();
      if (currentRequest === requestId.current) setPlaying(true);
    } catch (cause) {
      if (currentRequest === requestId.current) setError(String(cause));
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [spotify]);

  const toggle = useCallback(() => {
    const element = audio.current;
    if (!element?.src) return;
    if (element.paused) void element.play().then(() => setPlaying(true)).catch((cause) => setError(String(cause)));
    else { element.pause(); setPlaying(false); }
  }, []);
  const seek = useCallback((value: number) => {
    if (audio.current && Number.isFinite(value)) {
      audio.current.currentTime = value;
      setPosition(value);
    }
  }, []);
  const next = useCallback(() => { void select(queue.current, index + 1); }, [index, select]);
  const previous = useCallback(() => { void select(queue.current, index - 1); }, [index, select]);
  const stop = useCallback(() => {
    requestId.current++;
    audio.current?.pause();
    audio.current?.removeAttribute("src");
    queue.current = [];
    setIndex(-1);
    setPlaying(false);
    setPosition(0);
    setDuration(0);
    setError("");
  }, []);

  useEffect(() => {
    window.addEventListener("case-music:spotify-play", stop);
    return () => window.removeEventListener("case-music:spotify-play", stop);
  }, [stop]);

  useEffect(() => {
    if (neteasePlaying && playing) {
      audio.current?.pause();
      setPlaying(false);
    }
  }, [neteasePlaying, playing]);


  return <Context.Provider value={{ song, playing, loading, error, position, duration, play: select, toggle, seek, next, previous, stop }}>
    {children}
    <audio ref={audio} onEnded={next} onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onError={() => { setPlaying(false); setError("QQ 音乐播放失败，请检查账号权益或地区限制"); }} />
  </Context.Provider>;
}

export function useQqPlayback() {
  const value = useContext(Context);
  if (!value) throw new Error("QqPlaybackProvider is missing");
  return value;
}
