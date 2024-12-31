"use client";

import { Play, Pause, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import playerControl from "@/store/player-control";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function MobilePlayer() {
  const currentTrack = playerControl.useTracked.currentSong();
  const isPlaying = playerControl.useTracked.isPlaying();

  if (!currentTrack) return null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <div className="fixed bottom-[4.5rem] left-0 right-0 border-t bg-background p-3 md:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={currentTrack.content.pic_url}
                alt={currentTrack.content.name}
                className="h-10 w-10 rounded-md object-cover"
              />
              <div className="flex flex-col">
                <span className="font-medium line-clamp-1">
                  {currentTrack.content.name}
                </span>
                <span className="text-sm text-muted-foreground line-clamp-1">
                  {currentTrack.content.singer}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isPlaying) playerControl.set.pause();
                  else playerControl.set.play();
                }}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4 pl-0.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  playerControl.set.next();
                }}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[100dvh] p-0">
        {/* TODO: add a mobile player view */}
      </SheetContent>
    </Sheet>
  );
}
