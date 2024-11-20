"use client";

import { useState } from "react";
import { Play, SkipBack, SkipForward, Volume2, Heart } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

export default function Player() {
  const [volume, setVolume] = useState(75);
  const [isLiked, setIsLiked] = useState(false);

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
              <Play className="h-5 w-5 text-primary-foreground" />
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
  );
}