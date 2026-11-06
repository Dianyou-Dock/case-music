"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAudioSource } from "@/hooks/use-audio-source";
import { ApplicationResp } from "@/types/application";
import playerControl from "@/store/player-control";

export type SdkTrack = {
  id: string;
  name: string;
  uri?: string;
  artists: { name: string }[];
  album?: { name: string; images?: { url: string }[] };
};
type SdkState = {
  paused: boolean;
  position: number;
  duration: number;
  track_window: { current_track: SdkTrack };
};
type SdkPlayer = {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: string, listener: (value: any) => void): void;
  getCurrentState(): Promise<SdkState | null>;
  activateElement(): Promise<void>;
  togglePlay(): Promise<void>;
  nextTrack(): Promise<void>;
  previousTrack(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
};
type SpotifyWindow = Window & {
  Spotify?: { Player: new (options: { name: string; getOAuthToken: (callback: (token: string) => void) => void; volume: number }) => SdkPlayer };
  onSpotifyWebPlaybackSDKReady?: () => void;
};
type PlayRequest = { trackIds?: string[]; playlistId?: string; offsetTrackId?: string; queueTracks?: SdkTrack[] };
type SpotifyPlayback = {
  active: boolean;
  ready: boolean;
  error: string;
  track: SdkTrack | null;
  queue: SdkTrack[];
  paused: boolean;
  positionMs: number;
  durationMs: number;
  volume: number;
  play(request: PlayRequest): Promise<void>;
  toggle(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
};
type HeadlessStatus = {
  ready: boolean;
  device_id: string | null;
  error: string;
  track: SdkTrack | null;
  paused: boolean;
  position_ms: number;
  duration_ms: number;
};

const Context = createContext<SpotifyPlayback | null>(null);
const unsupportedCodecMessage = "当前内嵌播放器缺少 Spotify 所需的 AAC/MP4 解码支持，无法播放声音。请安装支持该编解码格式的应用版本。";

function supportsSpotifyAudioCodec() {
  const codec = 'audio/mp4; codecs="mp4a.40.2"';
  return document.createElement("audio").canPlayType(codec) !== "";
}

export function SpotifyPlaybackProvider({ children }: { children: React.ReactNode }) {
  const { audioSource } = useAudioSource();
  const connected = audioSource?.some((source) => source.id === "Spotify" && source.connected) ?? false;
  const neteasePlaying = playerControl.useTracked.isPlaying();
  const player = useRef<SdkPlayer | null>(null);
  const headless = useRef(false);
  const activeRef = useRef(false);
  const [active, setActive] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [track, setTrack] = useState<SdkTrack | null>(null);
  const [queue, setQueue] = useState<SdkTrack[]>([]);
  const [paused, setPaused] = useState(true);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [volume, setVolumeState] = useState(0.5);

  const applyState = useCallback((state: SdkState | null) => {
    if (!state || !activeRef.current) return;
    setTrack(state.track_window?.current_track ?? null);
    setPaused(state.paused);
    setPositionMs(state.position);
    setDurationMs(state.duration);
  }, []);

  useEffect(() => {
    if (!connected) {
      player.current?.disconnect();
      player.current = null;
      setDeviceId(null);
      activeRef.current = false;
      setActive(false);
      setError("");
      headless.current = false;
      return;
    }
    if (!navigator.requestMediaKeySystemAccess) {
      setError("This system WebView does not support encrypted media required by Spotify. Try the Android build or a supported browser.");
      return;
    }
    if (!supportsSpotifyAudioCodec()) {
      if (!navigator.userAgent.includes("Android") && "__TAURI_INTERNALS__" in window) {
        headless.current = true;
        let disposed = false;
        const update = (status?: HeadlessStatus) => {
          if (!status || disposed) return;
          setDeviceId(status.device_id);
          setError(status.error);
          if (status.track && activeRef.current) {
            setTrack(status.track);
            setPaused(status.paused);
            setPositionMs(status.position_ms);
            setDurationMs(status.duration_ms);
          }
        };
        void invoke<ApplicationResp<HeadlessStatus>>("spotify_headless_start")
          .then((response) => update(response.data))
          .catch((cause) => { if (!disposed) setError(String(cause)); });
        const timer = setInterval(() => {
          void invoke<ApplicationResp<HeadlessStatus>>("spotify_headless_status")
            .then((response) => update(response.data)).catch(() => {});
        }, 500);
        return () => { disposed = true; clearInterval(timer); };
      }
      setError(unsupportedCodecMessage);
      return;
    }
    let disposed = false;
    const setup = () => {
      const spotify = (window as SpotifyWindow).Spotify;
      if (disposed || !spotify || player.current) return;
      const instance = new spotify.Player({
        name: "壳音乐",
        volume: 0.5,
        getOAuthToken: async (callback) => {
          try {
            const response = await invoke<ApplicationResp<string>>("spotify_access_token");
            if (!response.data) throw new Error(response.msg || "Spotify token unavailable");
            callback(response.data);
          } catch (cause) {
            setError(String(cause));
          }
        },
      });
      player.current = instance;
      instance.addListener("ready", ({ device_id }: { device_id: string }) => {
        if (disposed) return;
        setDeviceId(device_id);
        setError("");
      });
      instance.addListener("not_ready", () => { if (!disposed) setDeviceId(null); });
      instance.addListener("player_state_changed", (state: SdkState | null) => { if (!disposed) applyState(state); });
      for (const event of ["initialization_error", "authentication_error", "account_error", "playback_error", "autoplay_failed"]) {
        instance.addListener(event, (detail: { message?: string }) => {
          if (!disposed) setError(detail?.message || event);
        });
      }
      void instance.connect().then((ok) => {
        if (!ok && !disposed) setError("Spotify Web Playback SDK could not create a player in this WebView.");
      }).catch((cause) => { if (!disposed) setError(String(cause)); });
    };
    const sdkWindow = window as SpotifyWindow;
    sdkWindow.onSpotifyWebPlaybackSDKReady = setup;
    if (sdkWindow.Spotify) setup();
    else if (!document.querySelector('script[data-spotify-sdk]')) {
      const script = document.createElement("script");
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      script.dataset.spotifySdk = "true";
      script.onerror = () => { if (!disposed) setError("Spotify Web Playback SDK could not load."); };
      document.head.appendChild(script);
    }
    return () => {
      disposed = true;
      instanceCleanup();
    };
    function instanceCleanup() {
      player.current?.disconnect();
      player.current = null;
      setDeviceId(null);
    }
  }, [connected, applyState]);

  useEffect(() => {
    if (!active || !deviceId) return;
    const timer = setInterval(() => {
      void player.current?.getCurrentState().then(applyState).catch(() => {});
    }, 500);
    return () => clearInterval(timer);
  }, [active, deviceId, applyState]);

  useEffect(() => {
    if (!neteasePlaying || !active) return;
    activeRef.current = false;
    setActive(false);
    if (headless.current) {
      void invoke("spotify_headless_command", { action: "pause", value: null });
      return;
    }
    void player.current?.getCurrentState().then((state) => {
      if (state && !state.paused) return player.current?.togglePlay();
    }).catch(() => {});
  }, [neteasePlaying, active]);

  const play = useCallback(async ({ trackIds = [], playlistId, offsetTrackId, queueTracks }: PlayRequest) => {
    if (!deviceId || (!headless.current && !player.current)) throw new Error(error || "Spotify player is still starting or is unsupported in this WebView.");
    if (!headless.current) void player.current?.activateElement();
    playerControl.set.pause();
    setError("");
    const response = await invoke<ApplicationResp<void>>("spotify_start_playback", {
      req: { device_id: deviceId, track_ids: trackIds, playlist_id: playlistId ?? null, offset_track_id: offsetTrackId ?? null },
    });
    if (response.code !== 0) throw new Error(response.msg || "Spotify playback failed");
    activeRef.current = true;
    setQueue(queueTracks ?? []);
    setActive(true);
  }, [deviceId, error]);

  const command = useCallback(async (action: string, value?: number) => {
    await invoke("spotify_headless_command", { action, value: value ?? null });
  }, []);
  const toggle = useCallback(async () => { if (headless.current) await command("toggle"); else await player.current?.togglePlay(); }, [command]);
  const next = useCallback(async () => { if (headless.current) await command("next"); else await player.current?.nextTrack(); }, [command]);
  const previous = useCallback(async () => { if (headless.current) await command("previous"); else await player.current?.previousTrack(); }, [command]);
  const seek = useCallback(async (value: number) => { if (headless.current) await command("seek", value); else await player.current?.seek(value); setPositionMs(value); }, [command]);
  const setVolume = useCallback(async (value: number) => { if (headless.current) await command("volume", value); else await player.current?.setVolume(value); setVolumeState(value); }, [command]);

  return <Context.Provider value={{ active, ready: Boolean(deviceId) && !error, error, track, queue, paused, positionMs, durationMs, volume, play, toggle, next, previous, seek, setVolume }}>{children}</Context.Provider>;
}

export function useSpotifyPlayback() {
  const context = useContext(Context);
  if (!context) throw new Error("useSpotifyPlayback must be used inside SpotifyPlaybackProvider");
  return context;
}
