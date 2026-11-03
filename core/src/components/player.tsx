"use client";

import { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Heart,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { invoke } from "@tauri-apps/api/core";
import ReactHowler from "react-howler";
import { ApplicationResp } from "@/types/application.ts";
import { SongRate } from "@/types/constants.ts";
import playerControl from "@/store/player-control";
import { formatDuration, formatProgress } from "@/lib/format.ts";
import { useAudioSource } from "@/hooks/use-audio-source";
import { cn } from "@/lib/utils";

interface PlayerProps {
  className?: string;
}

export default function Player({ className }: PlayerProps) {
  const { currentSource } = useAudioSource();
  const index = playerControl.useTracked.index();
  const isPlaying = playerControl.useTracked.isPlaying();
  const current = playerControl.useTracked.currentSong();
  const isLast = playerControl.useTracked.isLastSong();
  const immediately = playerControl.useTracked.immediately();
  const [volume, setVolume] = useState(50);
  const [songUrl, setSongUrl] = useState<string | null>(null); // 当前歌曲的 URL
  const progress = playerControl.useTracked.progress();
  const duration = playerControl.useTracked.duration();
  const seekRequest = playerControl.useTracked.seekRequest();
  const howlerRef = useRef<ReactHowler | null>(null);
  const [liked, setLiked] = useState(current?.liked || false);

  async function handleOnEnd() {
    if (immediately) {
      // clear immediately song, and play with index
      playerControl.set.state((draft) => {
        draft.immediately = undefined;
      });
    }
    if (isLast) {
      playerControl.set.pause();
      return;
    }
    playerControl.set.pause();
    playerControl.set.next();
    playerControl.set.play();
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
    playerControl.set.progress(0);
    playerControl.set.duration(current ? current.content.duration / 1000 : 0);
    if (!current) return;

    let active = true;
    setLiked(current.liked);
    const req = {
      source: current.type,
      songs: [current.content.id],
      rate: SongRate.L,
    };
    invoke<ApplicationResp<{ urls: { content: { url: string | null } }[] }>>(
      "songs_url",
      { req }
    ).then((res) => {
      if (active) setSongUrl(res.data?.urls?.[0]?.content?.url || null);
    }).catch((error) => {
      console.error("Could not load song URL", error);
    });
    return () => { active = false; };
  }, [index, current?.content.id, current?.type]);

  async function handleHeartClick(id: number) {
    const newLiked = !liked;

    setLiked(newLiked);

    await invoke<ApplicationResp<boolean>>("like_song", {
      req: { source: currentSource, song_id: id, is_like: newLiked },
    });

    if (immediately) {
      playerControl.set.likeImmediately(newLiked);
    } else {
      playerControl.set.likeCurrent(newLiked);
    }
  }

  return (
    <>
      {songUrl && (
        <ReactHowler
          key={current?.content.id}
          src={songUrl}
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
        <div className="mx-auto flex w-full items-center justify-between">
          {current ? (
            <div className="flex items-center gap-4 flex-1">
              <img
                src={current?.content.pic_url}
                alt="Album art"
                className="h-12 w-12 rounded-lg object-cover"
              />
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="font-medium">
                    {current?.content?.name || ""}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {current?.content?.singer || ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleHeartClick(current.content.id)}
                >
                  <Heart
                    className={`h-4 w-4 ${
                      liked
                        ? "fill-primary text-primary"
                        : "text-muted-foreground hover:text-foreground text-green-500"
                    }`}
                  />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 flex-1"></div>
          )}

          <div className="flex flex-col items-center gap-2 flex-1">
            <div className="flex items-center gap-6">
              <SkipBack
                className="h-5 w-5 cursor-pointer text-muted-foreground hover:text-foreground text-green-500 "
                onClick={() => playerControl.set.back()}
              />
              <div className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-transparent ">
                <div className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-transparent border-2 border-green-500 hover:bg-green-500">
                  {!isPlaying ? (
                    <Play
                      className="h-5 w-5 text-primary-foreground"
                      onClick={() => playerControl.set.play()}
                    />
                  ) : (
                    <Pause
                      className="h-5 w-5 text-primary-foreground"
                      onClick={() => playerControl.set.pause()}
                    />
                  )}
                </div>
              </div>
              <SkipForward
                className="h-5 w-5 cursor-pointer text-muted-foreground hover:text-foreground text-green-500"
                onClick={() => playerControl.set.next()}
              />
            </div>
            <div className="flex w-[400px] items-center gap-2">
              <span className="text-sm text-muted-foreground mr-2">
                {formatProgress(progress)}
              </span>
              <Slider
                value={[progress]}
                max={Math.max(duration, 1)}
                step={1}
                className="cursor-pointer"
                onValueChange={handleSliderChange}
              />
              <span className="text-sm text-muted-foreground">
                {formatDuration(current?.content?.duration || 0)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-green-500 flex-1 justify-end">
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
    </>
  );
}
