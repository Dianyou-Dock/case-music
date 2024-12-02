"use client";

import { useState } from "react";
import { Play, SkipBack, SkipForward, Volume2, Heart } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {invoke} from "@tauri-apps/api/core";
import {Howl} from 'howler';

export default function Player() {
  const [volume, setVolume] = useState(75);
  const [isLiked, _setIsLiked] = useState(false);
  const [songUrl, setSongUrl] = useState<string | null>(null); // 当前歌曲的 URL
  const [isPlaying, setIsPlaying] = useState(false); // 播放状态

  interface ResponseData {
    code: number;
    msg: string;
    data: {
      urls: {
        type: string;
        content: {
          id: number;
          url: string;  // 这是我们需要的歌曲链接
          rate: number;
        };
      }[];
    };
  }

  async function songsUrl() {
    console.log("songsUrl function called");  // 确认函数是否被触发
    const req = {
      source: "Netesae",
      songs: [480097437],
      rate: "L",
    }

    try {
      const resp = await invoke("songs_url", {req: req}) as ResponseData;
      console.log(resp);

      const url = resp.data.urls[0].content.url
      setSongUrl(url);
    } catch (error) {
      console.error("Error invoking songs_url:", error);
    }
  }

  // 播放音频
  const playAudio = () => {
    if (songUrl) {
      const newAudio = new Howl({
        src: [songUrl], // 音乐的 URL
        volume: volume / 100, // 设置音量，范围是 0.0 到 1.0
        onplay: function() {
          setIsPlaying(false); // 播放结束后改变播放状态
        },
      });

      newAudio.play();
      setIsPlaying(true); // 设置为正在播放
    }
  };

  // 暂停音频
  const pauseAudio = () => {
    // if (audio) {
    //   audio.pause();
    //   setIsPlaying(false); // 设置为暂停状态
    // }
    setIsPlaying(false); // 设置为暂停状态
  };

  // 切换播放/暂停
  const togglePlayPause = () => {
    if (isPlaying) {
      pauseAudio();
    } else {
      playAudio();
    }
  };

  return (
    <div className="border-t bg-background p-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-4">
          <img
            src="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=50&h=50&fit=crop"
            alt="Album art"
            className="h-12 w-12 rounded-lg object-cover"
          />
          <div className="flex items-center gap-3">
            <div>
              <h3 className="font-medium">Summer Nights</h3>
              <p className="text-sm text-muted-foreground">The Midnight</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              // onClick={() => setIsLiked(!isLiked)}
                onClick={() => songsUrl()}
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
              <div
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-primary"
                  onClick={togglePlayPause}
              >
                <Play className="h-5 w-5 text-primary-foreground"/>
              </div>
            </div>
            <SkipForward className="h-5 w-5 cursor-pointer text-muted-foreground hover:text-foreground"/>
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
  );
}