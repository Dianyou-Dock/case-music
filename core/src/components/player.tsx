"use client";

import {useState, useEffect, useRef} from "react";
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
import {back, next, playerControl} from "@/components/player-control";
import {formatDuration, formatProgress} from "@/lib/format.ts";

export default function Player() {

  const [volume, setVolume] = useState(75);
  const [isLiked, setIsLiked] = useState(false);
  const [songUrl, setSongUrl] = useState<string | null>(null); // 当前歌曲的 URL
  const [pictureUrl, setPictureUrl] = useState<string | undefined>(undefined);
  const [isPlaying, setIsPlaying] = useState(false); // 播放状态
  const [current, setCurrent] = useState<SongInfo|undefined>(undefined);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [progress, setProgress] = useState(0); // 播放进度
  const [duration, setDuration] = useState(0); // 总时长
  const howlerRef = useRef<ReactHowler | null>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);


  async function handleOnEnd() {
    setIsPlaying(false);
  }

  async function handleHeartClick() {
    console.log("handleHeartClick", current, currentIndex);
    if (current === undefined){
      return
    }

    const newLiked = !isLiked
    setIsLiked(newLiked)
    const res = await invoke<ApplicationResp<boolean>>("like_song", {req: {source: current.type, song_id: current.content.id, is_like: newLiked}});
    console.log("handleHeartClick res: ", res);
    if (res.data !== undefined && res.data) {
      if (currentIndex != -1) {
        // update play control
        const state = playerControl.getState() as any;
        state.likeds[currentIndex] = newLiked;
        playerControl.setState(state);
      }
    }
  }

  useEffect(() => {
    // 当播放器正在播放时，定时更新播放进度
    if (isPlaying && songUrl) {


      // TODO: 这里有点问题, 一旦在歌曲播放完后在点击播放, 这里的seek不会从0开始跳, 例如开始是8, 然后会在这里一直卡这个数,等到歌曲真实播放到了8s后,这个seek开会开始走数
      progressInterval.current = setInterval(() => {
        if (howlerRef?.current && howlerRef.current.howlerState() === "loaded") {

          const currentProgress = howlerRef.current.seek() as number;
          setProgress(currentProgress);
        }
      }, 1000); // 每秒更新一次
    } else {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
    }
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [isPlaying, songUrl]);

  const handleSliderChange = (value: number[]) => {
    const newProgress = value[0];
    setProgress(newProgress);
    if (howlerRef?.current) {
      howlerRef.current.seek(newProgress); // 设置播放器的新播放位置
    }
  };

  const handleLoad = () => {
    console.log("into onload")
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
  }


  async function get_song_url(songInfo: SongInfo, currentIndex: number) {
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
        setCurrentIndex(currentIndex);
      }

    });
  }

  useEffect(() => {
    playerControl.subscribe(
      state => {

        const data = state as any;
        const stateCurrent = data.current as SongInfo;
        const stateImmediately = data.immediately as SongInfo;


        // immediately
        if (stateImmediately !== undefined) {
          get_song_url(stateImmediately, -1).then(() => {
            setIsLiked(data.thisLiked);
          });

          return
        }

        // not immediately
        if (stateCurrent !== undefined && stateCurrent.content.id != current?.content.id) {
          const currentIndex = data.thisIndex;
          get_song_url(stateCurrent, currentIndex).then(() => {
            setIsLiked(data.thisLiked);
          });

        }
      }
    )
  }, [current]);

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
          // onSeek={}
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
                onClick={() => handleHeartClick()}
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
              <span className="text-sm text-muted-foreground">{formatProgress(progress)}</span>
              <Slider
                value={[progress]}
                max={duration}
                step={1}
                className="cursor-pointer"
                onValueChange={handleSliderChange}
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
