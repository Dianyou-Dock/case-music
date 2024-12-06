"use client";

import { useState, useEffect } from "react";
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
import {SongInfoProps} from "@/types/song.ts";
import {ApplicationResp} from "@/types/application.ts";
import {SongRate} from "@/types/constants.ts";


export default function Player({songInfo}: SongInfoProps) {

  const [volume, setVolume] = useState(75);
  const [isLiked, setIsLiked] = useState(false);
  const [songUrl, setSongUrl] = useState<string | null>(null); // 当前歌曲的 URL
  const [pictureUrl, setPictureUrl] = useState<string | undefined>(undefined);
  const [isPlaying, setIsPlaying] = useState(false); // 播放状态

  useEffect(() => {
    const req = {
      source: songInfo.type,
      songs: [songInfo.content.id],
      rate: SongRate.L,
    };

    invoke<ApplicationResp<any>>("songs_url", { req: req }).then((res) => {

      if (res.data !== undefined) {
        const url = res.data.urls[0].content.url;
        setSongUrl(url);

        setPictureUrl(songInfo.content.pic_url)
      }

    });
  }, []);

  return (
    <>
      {songUrl && (
        <ReactHowler
          src={songUrl}
          preload
          playing={isPlaying}
          volume={volume / 100}
        />
      )}
      <div className="border-t bg-background p-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src={pictureUrl}
              alt="Album art"
              className="h-12 w-12 rounded-lg object-cover"
            />
            <div className="flex items-center gap-3">
              <div>
                <h3 className="font-medium">Midnight City</h3>
                <p className="text-sm text-muted-foreground">M83</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsLiked(!isLiked)}
              >
                <Heart
                  className={`h-4 w-4 ${
                    isLiked
                      ? "fill-primary text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                />
              </Button>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-6">
              <SkipBack className="h-5 w-5 cursor-pointer text-muted-foreground hover:text-foreground" />
              <div className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-primary">
                <div className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-primary">
                  {!isPlaying ? (
                    <Play
                      className="h-5 w-5 text-primary-foreground"
                      onClick={() => setIsPlaying(!isPlaying)}
                    />
                  ) : (
                    <Pause
                      className="h-5 w-5 text-primary-foreground"
                      onClick={() => setIsPlaying(!isPlaying)}
                    />
                  )}
                </div>
              </div>
              <SkipForward className="h-5 w-5 cursor-pointer text-muted-foreground hover:text-foreground" />
            </div>
            <div className="flex w-[400px] items-center gap-2">
              <span className="text-sm text-muted-foreground">2:14</span>
              <Slider
                defaultValue={[33]}
                max={100}
                step={1}
                className="cursor-pointer"
              />
              <span className="text-sm text-muted-foreground">3:25</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            <Slider
              defaultValue={[volume]}
              max={100}
              step={1}
              onValueChange={(value) => setVolume(value[0])}
              className="w-[100px]"
            />
          </div>
        </div>
      </div>
    </>
  );
}
