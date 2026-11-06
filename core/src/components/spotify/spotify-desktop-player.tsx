"use client";

import { Pause, Play, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { formatDuration, formatProgress } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SpotifyQueue } from "@/components/spotify/spotify-queue";
import { SpotifyPlayerHeart } from "@/components/spotify/spotify-player-heart";
import { useSpotifyPlayback } from "@/hooks/use-spotify-playback";

export function SpotifyDesktopPlayer({ className }: { className?: string }) {
  const spotify = useSpotifyPlayback();
  const track = spotify.track;
  return <div className={cn("border-t bg-background p-4", className)}>
    <div className="mx-auto flex w-full items-center justify-between">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {track?.album?.images?.[0]?.url && <img src={track.album.images[0].url} alt="" className="h-12 w-12 shrink-0 object-contain" />}
        <div className="min-w-0"><p className="truncate font-medium">{track?.name ?? "Spotify"}</p><p className="truncate text-sm text-muted-foreground">{track?.artists?.map((artist) => artist.name).join(", ") ?? ""}</p></div><SpotifyPlayerHeart id={track?.id} name={track?.name} />
      </div>
      <div className="flex flex-1 flex-col items-center gap-2">
        <div className="flex items-center gap-6">
          <Button variant="ghost" size="icon" onClick={() => void spotify.previous()} aria-label="上一首"><SkipBack className="h-5 w-5 text-green-500" /></Button>
          <Button variant="outline" size="icon" className="rounded-full border-green-500" onClick={() => void spotify.toggle()} aria-label={spotify.paused ? "播放" : "暂停"}>{spotify.paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}</Button>
          <Button variant="ghost" size="icon" onClick={() => void spotify.next()} aria-label="下一首"><SkipForward className="h-5 w-5 text-green-500" /></Button>
        </div>
        <div className="flex w-[400px] items-center gap-2">
          <span className="text-sm text-muted-foreground">{formatProgress(spotify.positionMs / 1000)}</span>
          <Slider value={[spotify.positionMs]} max={Math.max(spotify.durationMs, 1)} step={1000} onValueChange={(value) => void spotify.seek(value[0])} />
          <span className="text-sm text-muted-foreground">{formatDuration(spotify.durationMs)}</span>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-end gap-2 text-green-500">
        <SpotifyQueue /><span className="text-sm">Spotify</span><Volume2 className="h-5 w-5" />
        <Slider value={[spotify.volume * 100]} max={100} step={1} onValueChange={(value) => void spotify.setVolume(value[0] / 100)} className="w-[100px]" />
      </div>
    </div>
    {spotify.error && <p role="alert" className="mt-2 text-sm text-destructive">{spotify.error}</p>}
  </div>;
}
