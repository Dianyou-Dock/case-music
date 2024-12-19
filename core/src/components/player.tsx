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
import { SongInfo } from "@/types/song.ts";
import { ApplicationResp } from "@/types/application.ts";
import { SongRate } from "@/types/constants.ts";
import playerControl from "@/store/player-control";
import { formatDuration, formatProgress } from "@/lib/format.ts";
import { useAudioSource } from "@/hooks/use-audio-source";

export default function Player() {
  const { currentSource } = useAudioSource();
  const index = playerControl.useTracked.index();
  const isPlaying = playerControl.useTracked.isPlaying();
  const current = playerControl.useTracked.currentSong();
  const isLast = playerControl.useTracked.isLastSong();
  const immediately = playerControl.useTracked.immediately();
  const [volume, setVolume] = useState(75);
  const [songUrl, setSongUrl] = useState<string | null>(null); // 当前歌曲的 URL
  const [pictureUrl, setPictureUrl] = useState<string | undefined>(undefined);
  const [progress, setProgress] = useState(0); // 播放进度
  const [duration, setDuration] = useState(0); // 总时长
  const howlerRef = useRef<ReactHowler | null>(null);
  const [seekInterval, setSeekInterval] = useState<NodeJS.Timeout | null>(null);
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
    if (isPlaying && !seekInterval) {
      const interval = setInterval(() => {
        if (howlerRef.current) {
          setProgress(howlerRef.current.seek());
        }
      }, 1000);
      setSeekInterval(interval);
    } else if (!isPlaying && seekInterval) {
      clearInterval(seekInterval);
      setSeekInterval(null);
    }

    return () => {
      if (seekInterval) {
        clearInterval(seekInterval);
      }
    };
  }, [isPlaying, seekInterval]);

  const handleSliderChange = (value: number[]) => {
    const newProgress = value[0];
    setProgress(newProgress);
    if (howlerRef?.current) {
      howlerRef.current.seek(newProgress); // 设置播放器的新播放位置
    }
  };

  const handleLoad = () => {
    if (howlerRef?.current) {
      const songDuration = howlerRef.current.duration();
      setDuration(songDuration); // 获取歌曲总时长
    }
  };

  const handlePlay = () => {
    if (howlerRef?.current) {
      const currentProgress = howlerRef.current.seek() as number;
      setProgress(currentProgress);
    }
  };

  async function get_song_url(songInfo: SongInfo) {
    const req = {
      source: songInfo.type,
      songs: [songInfo.content.id],
      rate: SongRate.L,
    };

    invoke<ApplicationResp<any>>("songs_url", { req: req }).then((res) => {
      if (res.data) {
        const url = res.data.urls[0].content.url;
        setSongUrl(url);
        setPictureUrl(songInfo.content.pic_url);
      }
    });
  }

  useEffect(() => {
    if (!current) {
      return;
    }
    if (index >= 0) {
      get_song_url(current);
    }
  }, [index, current]);

  async function handleHeartClick(id: number) {
    const newLiked = !liked;

    // update local state
    setLiked(newLiked);

    await invoke<ApplicationResp<boolean>>("like_song", {
      req: { source: currentSource, song_id: id, is_like: newLiked },
    });
  }

  return (
    <>
      {songUrl && (
        <ReactHowler
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
      <div className="border-t bg-background p-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          {current ? (
            <div className="flex items-center gap-4 flex-1">
              <img
                src={pictureUrl}
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
                max={duration}
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
