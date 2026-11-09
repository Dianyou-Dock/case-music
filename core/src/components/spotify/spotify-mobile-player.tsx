"use client";

import { useState } from "react";
import { ChevronDown, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { SpotifyQueue } from "@/components/spotify/spotify-queue";
import { SpotifyPlayerHeart } from "@/components/spotify/spotify-player-heart";
import { useSpotifyPlayback } from "@/hooks/use-spotify-playback";
import { formatDuration, formatProgress } from "@/lib/format";
import { PlaybackModeButton } from "@/components/playback-mode-button";

export function SpotifyMobilePlayer() {
  const spotify = useSpotifyPlayback();
  const [open, setOpen] = useState(false);
  const track = spotify.track;
  const image = track?.album?.images?.[0]?.url;
  const seekMax = Math.max(spotify.durationMs, 1);
  const position = Math.min(spotify.positionMs, seekMax);
  return <>
    <div className="relative shrink-0 border-t bg-background pb-2 pt-2 md:hidden">
      <div className="flex min-w-0 items-center gap-2 px-3">
        <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setOpen(true)} aria-label="打开播放器">
          {image && <img src={image} alt="" className="h-11 w-11 shrink-0 object-contain" />}
          <span className="min-w-0 flex-1"><span className="block truncate font-medium">{track?.name ?? "Spotify"}</span><span className="block truncate text-sm text-muted-foreground">{track?.artists?.map((artist) => artist.name).join(", ") ?? ""}</span></span>
        </button>
        <SpotifyPlayerHeart id={track?.id} name={track?.name} />
        <Button variant="ghost" size="icon" onClick={() => void spotify.toggle()} aria-label={spotify.paused ? "播放" : "暂停"}>{spotify.paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}</Button>
        <Button variant="ghost" size="icon" onClick={() => void spotify.next()} aria-label="下一首"><SkipForward className="h-5 w-5" /></Button>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1 bg-muted"><div className="h-full bg-primary" style={{ width: `${position / seekMax * 100}%` }} /></div>
    </div>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="bottom" className="h-[100dvh] overflow-hidden p-0 [&>button]:hidden">
        <SheetTitle className="sr-only">Spotify</SheetTitle>
        <div className="flex h-full min-h-0 flex-col px-6 pb-8 pt-14">
          <div className="mb-5 flex items-center justify-between"><Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="关闭播放器"><ChevronDown className="h-7 w-7" /></Button><div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">Spotify</span><PlaybackModeButton /><SpotifyQueue /></div></div>
          <div className="flex min-h-0 flex-1 flex-col justify-center text-center">
            {image && <img src={image} alt="" className="mx-auto aspect-square max-w-full object-contain shadow-lg" style={{ width: "min(76vw, 38dvh, 360px)" }} />}
            <div className="mt-5 flex items-center justify-center gap-2"><h2 className="truncate text-xl font-semibold">{track?.name ?? "Spotify"}</h2><SpotifyPlayerHeart id={track?.id} name={track?.name} /></div>
            <p className="truncate text-muted-foreground">{track?.artists?.map((artist) => artist.name).join(", ") ?? ""}</p>
          </div>
          <div className="shrink-0 border-t pt-4">
            <Slider value={[position]} max={seekMax} step={1000} onValueChange={(value) => void spotify.seek(value[0])} />
            <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{formatProgress(position / 1000)}</span><span>{formatDuration(spotify.durationMs)}</span></div>
            <div className="mt-4 flex items-center justify-center gap-12">
              <Button variant="ghost" size="icon" onClick={() => void spotify.previous()} aria-label="上一首"><SkipBack className="h-7 w-7" /></Button>
              <Button size="icon" className="h-14 w-14 rounded-full" onClick={() => void spotify.toggle()} aria-label={spotify.paused ? "播放" : "暂停"}>{spotify.paused ? <Play className="h-7 w-7" /> : <Pause className="h-7 w-7" />}</Button>
              <Button variant="ghost" size="icon" onClick={() => void spotify.next()} aria-label="下一首"><SkipForward className="h-7 w-7" /></Button>
            </div>
            {spotify.error && <p role="alert" className="mt-3 text-center text-sm text-destructive">{spotify.error}</p>}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  </>;
}
