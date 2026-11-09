"use client";

import { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { invoke } from "@tauri-apps/api/core";
import ReactHowler from "react-howler";
import { ApplicationResp } from "@/types/application.ts";
import { SongRate } from "@/types/constants.ts";
import playerControl from "@/store/player-control";
import { formatDuration, formatProgress } from "@/lib/format.ts";
import { cn } from "@/lib/utils";
import { PlayQueue } from "@/components/play-queue";
import { recordRecommendationFeedback } from "@/lib/recommendation-feedback";
import { useSpotifyPlayback } from "@/hooks/use-spotify-playback";
import { SpotifyDesktopPlayer } from "@/components/spotify/spotify-desktop-player";
import { NetEasePlayerHeart } from "@/components/music/netease-player-heart";
import { QqPlayerHeart } from "@/components/music/qq-player-heart";
import { useQqPlayback } from "@/hooks/use-qq-playback";

interface PlayerProps {
  className?: string;
}

export default function Player({ className }: PlayerProps) {
  const spotify = useSpotifyPlayback();
  const qq = useQqPlayback();
  const qqActive = Boolean(qq.song);
  const index = playerControl.useTracked.index();
  const isPlaying = playerControl.useTracked.isPlaying();
  const current = playerControl.useTracked.currentSong();
  const [volume, setVolume] = useState(50);
  const [songUrl, setSongUrl] = useState<string | null>(null); // 当前歌曲的 URL
  const [songError, setSongError] = useState("");
  const [urlRetry, setUrlRetry] = useState(0);
  const progress = playerControl.useTracked.progress();
  const duration = playerControl.useTracked.duration();
  const seekRequest = playerControl.useTracked.seekRequest();
  const howlerRef = useRef<ReactHowler | null>(null);
  const playbackRef = useRef({ progress: 0, duration: 0, completed: false });

  useEffect(() => {
    if (qqActive) qq.setVolume(volume / 100);
  }, [qqActive, qq.setVolume, volume]);

  useEffect(() => {
    playbackRef.current.progress = progress;
    playbackRef.current.duration = duration;
  }, [progress, duration]);

  useEffect(() => {
    if (!current) return;
    playbackRef.current = { progress: 0, duration: 0, completed: false };
    return () => {
      const played = playbackRef.current;
      if (!played.completed && played.progress >= 5 && played.duration > 0 && played.progress / played.duration < 0.3) {
        recordRecommendationFeedback(current, "skipped");
      }
    };
  }, [current?.content.id, current?.type]);

  function handleOnEnd() {
    playbackRef.current.completed = true;
    if (current) recordRecommendationFeedback(current, "completed");
    playerControl.set.state((draft) => {
      if (draft.immediately) {
        draft.immediately = undefined;
        draft.isPlaying = draft.index >= 0 && draft.index < draft.songs.length;
      } else if (draft.index >= 0 && draft.index < draft.songs.length - 1) {
        draft.index += 1;
        draft.isPlaying = true;
      } else {
        draft.isPlaying = false;
      }
    });
  }

  useEffect(() => {
    if (!isPlaying || !songUrl) return;
    const interval = setInterval(() => {
      const position = howlerRef.current?.seek();
      if (typeof position === "number" && Number.isFinite(position)) {
        playerControl.set.progress(position);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [isPlaying, songUrl]);

  useEffect(() => {
    if (seekRequest && howlerRef.current) {
      howlerRef.current.seek(seekRequest.position);
    }
  }, [seekRequest]);

  const handleSliderChange = (value: number[]) => {
    const newProgress = value[0];
    playerControl.set.seek(newProgress);
  };

  const handleLoad = () => {
    if (howlerRef?.current) {
      const songDuration = howlerRef.current.duration();
      playerControl.set.duration(songDuration);
    }
  };

  const handlePlay = () => {
    if (howlerRef?.current) {
      const currentProgress = howlerRef.current.seek() as number;
      playerControl.set.progress(currentProgress);
    }
  };

  useEffect(() => {
    setSongUrl(null);
    setSongError("");
    playerControl.set.progress(0);
    playerControl.set.duration(current ? current.content.duration / 1000 : 0);
    if (!current) return;

    let active = true;
    const req = {
      source: current.type,
      songs: [current.content.id],
      rate: SongRate.L,
    };
    invoke<ApplicationResp<{ urls: { content: { url: string | null } }[] }>>(
      "songs_url",
      { req }
    ).then((res) => {
      if (!active) return;
      const url = res.data?.urls?.[0]?.content?.url;
      if (res.code !== 0 || !url) {
        setSongError(res.msg || "网易云没有返回可播放音源，请检查登录状态或歌曲版权");
        return;
      }
      setSongUrl(url);
    }).catch((error) => {
      console.error("Could not load song URL", error);
      if (active) setSongError(String(error));
    });
    return () => { active = false; };
  }, [index, current?.content.id, current?.type, urlRetry]);

  return (
    <>
      {spotify.active && !qqActive ? <SpotifyDesktopPlayer className={className} /> : <>
      {songUrl && !qqActive && (
        <ReactHowler
          key={current?.content.id}
          src={songUrl}
          html5={true}
          preload={true}
          playing={isPlaying}
          volume={volume / 100}
          onEnd={handleOnEnd}
          onLoad={handleLoad} // 加载完成时设置总时长
          ref={howlerRef} // 直接使用 useRef 的引用
          onPlay={handlePlay}
        />
      )}
      <div className={cn("border-t bg-background p-4", className)}>
        {songError && !qqActive && <div role="alert" className="mb-2 text-sm text-destructive">{songError} <button type="button" className="underline" onClick={() => setUrlRetry((value) => value + 1)}>重试</button></div>}
        <div className="mx-auto flex w-full items-center justify-between">
          {qqActive || current ? (
            <div className="flex items-center gap-4 flex-1">
              <img
                src={qqActive ? qq.song?.pic_url : current?.content.pic_url}
                alt="Album art"
                className="h-12 w-12 rounded-lg object-cover"
              />
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="font-medium">
                    {qqActive ? qq.song?.name : current?.content?.name || ""}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {qqActive ? qq.song?.artists.map((artist) => artist.name).join("、") : current?.content?.singer || ""}
                  </p>
                </div>
                {qqActive ? <QqPlayerHeart id={qq.song?.id} name={qq.song?.name} /> : <NetEasePlayerHeart />}
              </div>
              {qqActive && qq.error && <p role="alert" className="max-w-40 truncate text-xs text-destructive" title={qq.error}>{qq.error}</p>}
            </div>
          ) : (
            <div className="flex items-center gap-4 flex-1"></div>
          )}

          <div className="flex flex-col items-center gap-2 flex-1">
            <div className="flex items-center gap-6">
              <SkipBack
                className="h-5 w-5 cursor-pointer text-muted-foreground hover:text-foreground text-green-500"
                onClick={() => qqActive ? qq.previous() : playerControl.set.back()}
              />
              <div className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-transparent ">
                <div className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-transparent border-2 border-green-500 hover:bg-green-500">
                  {!(qqActive ? qq.playing : isPlaying) ? (
                    <Play
                      className="h-5 w-5 text-primary-foreground"
                      onClick={() => qqActive ? qq.toggle() : playerControl.set.play()}
                    />
                  ) : (
                    <Pause
                      className="h-5 w-5 text-primary-foreground"
                      onClick={() => qqActive ? qq.toggle() : playerControl.set.pause()}
                    />
                  )}
                </div>
              </div>
              <SkipForward
                className="h-5 w-5 cursor-pointer text-muted-foreground hover:text-foreground text-green-500"
                onClick={() => qqActive ? qq.next() : playerControl.set.next()}
              />
            </div>
            <div className="flex w-[400px] items-center gap-2">
              <span className="text-sm text-muted-foreground mr-2">
                {formatProgress(qqActive ? qq.position : progress)}
              </span>
              <Slider
                value={[qqActive ? Math.min(qq.position, Math.max(qq.duration, 1)) : progress]}
                max={Math.max(qqActive ? qq.duration : duration, 1)}
                step={1}
                className="cursor-pointer"
                onValueChange={(value) => qqActive ? qq.seek(value[0]) : handleSliderChange(value)}
              />
              <span className="text-sm text-muted-foreground">
                {qqActive ? formatProgress(qq.duration) : formatDuration(current?.content?.duration || 0)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-green-500 flex-1 justify-end">
            <PlayQueue />
            <Volume2 className="h-5 w-5" />
            <Slider
              defaultValue={[volume]}
              max={100}
              step={1}
              onValueChange={(value) => setVolume(value[0])}
              className="w-[100px] text-green-500 bg-transparent"
            />
          </div>
        </div>
      </div>
      </>}
    </>
  );
}
