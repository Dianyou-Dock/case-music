"use client";

import {useState, useEffect} from "react";
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
import {SongInfo} from "@/types/song.ts";
import {ApplicationResp} from "@/types/application.ts";
import {SongRate} from "@/types/constants.ts";
import {back, next, playerControl, updateState} from "@/components/player-control";
import {formatDuration} from "@/lib/format.ts";

export default function Player() {

  const [volume, setVolume] = useState(75);
  const [isLiked, setIsLiked] = useState(false);
  const [songUrl, setSongUrl] = useState<string | null>(null); // 当前歌曲的 URL
  const [pictureUrl, setPictureUrl] = useState<string | undefined>(undefined);
  const [isPlaying, setIsPlaying] = useState(false); // 播放状态
  const [current, setCurrent] = useState<SongInfo|undefined>(undefined);


  async function handleOnEnd() {
    setIsPlaying(false);
    const state = playerControl.getState();

    updateState(state).then(() => {});
  }

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
        setPictureUrl(songInfo.content.pic_url)
        setIsPlaying(true);
        setCurrent(songInfo);
      }

    });
  }

  useEffect(() => {
    playerControl.subscribe(
      state => {

        const data = state as any;
        const stateCurrent = data.current as SongInfo;
        const stateImmediately = data.immediately as SongInfo;
        if (stateImmediately !== undefined) {
          get_song_url(stateImmediately).then(() => {});
          return
        }

        if (stateCurrent !== undefined && stateCurrent.content.id != current?.content.id) {
          get_song_url(stateCurrent).then(() => {});
        }
      }
    )
  }, [current]);

  return (
    <>
      {songUrl && (
        <ReactHowler
          src={songUrl}
          preload={false}
          playing={isPlaying}
          volume={volume / 100}
          onEnd={handleOnEnd}
          // onLoad={onLoad}
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
                <h3 className="font-medium">
                  {current?.content.name || ""}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {current?.content.singer || ""}
                </p>
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
              <SkipBack
                className="h-5 w-5 cursor-pointer text-muted-foreground hover:text-foreground"
                onClick={() => back()}
              />
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
              <SkipForward
                className="h-5 w-5 cursor-pointer text-muted-foreground hover:text-foreground"
                onClick={() => next()}
              />
            </div>
            <div className="flex w-[400px] items-center gap-2">
              <span className="text-sm text-muted-foreground">0:00</span>
              <Slider
                defaultValue={[33]}
                max={100}
                step={1}
                className="cursor-pointer"
              />
              <span className="text-sm text-muted-foreground">{formatDuration(current?.content.duration || 0)}</span>
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
