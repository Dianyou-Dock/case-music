"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlaybackStore } from "@/stores/playback/store";
import { PlayerControls } from "./player-controls";
import { PlayerSeeker } from "./player-seeker";
import { PlayerVolume } from "./player-volume";
import { Sheet } from "@/components/ui/sheet";

export function MobilePlaybackView() {
  const currentTrack = usePlaybackStore((state) => state.currentTrack);
  
  if (!currentTrack) return null;

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="w-8" />
        <span className="font-semibold">Now Playing</span>
        <Sheet.Close asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronDown className="h-5 w-5" />
          </Button>
        </Sheet.Close>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
        <img
          src={currentTrack.coverUrl}
          alt={currentTrack.title}
          className="aspect-square w-64 rounded-lg object-cover shadow-lg"
        />
        <div className="text-center">
          <h2 className="text-xl font-semibold">{currentTrack.title}</h2>
          <p className="text-muted-foreground">{currentTrack.artist}</p>
        </div>
      </div>

      <div className="flex flex-col gap-6 p-6 pt-0">
        <PlayerSeeker />
        <PlayerControls />
        <PlayerVolume className="flex md:hidden" />
      </div>
    </div>
  );
}