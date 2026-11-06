"use client";

import { Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import { useQqPlayback } from "@/hooks/use-qq-playback";
import { Button } from "@/components/ui/button";
import { formatProgress } from "@/lib/format";

export function QqPlayer() {
  const player = useQqPlayback();
  if (!player.song) return null;
  return <div className="flex shrink-0 items-center gap-3 border-t bg-background px-3 py-2">
    {player.song.pic_url && <img src={player.song.pic_url} alt="" className="h-10 w-10 rounded object-cover" />}
    <div className="min-w-0 flex-1"><p className="truncate font-medium">{player.song.name}</p><p className="truncate text-xs text-muted-foreground">{player.song.artists.map((artist) => artist.name).join("、")}</p></div>
    <Button variant="ghost" size="icon" onClick={player.previous} aria-label="上一首"><SkipBack className="h-4 w-4" /></Button>
    <Button variant="ghost" size="icon" onClick={player.toggle} disabled={player.loading} aria-label={player.playing ? "暂停" : "播放"}>{player.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
    <Button variant="ghost" size="icon" onClick={player.next} aria-label="下一首"><SkipForward className="h-4 w-4" /></Button>
    <span className="hidden text-xs text-muted-foreground sm:inline">{formatProgress(player.position)}</span>
    <input type="range" className="hidden w-24 sm:block" min={0} max={Math.max(player.duration, 1)} value={Math.min(player.position, Math.max(player.duration, 1))} onChange={(event) => player.seek(Number(event.target.value))} aria-label="播放进度" />
    <Button variant="ghost" size="icon" onClick={player.stop} aria-label="关闭"><X className="h-4 w-4" /></Button>
    {player.error && <p role="alert" className="max-w-48 truncate text-xs text-destructive" title={player.error}>{player.error}</p>}
  </div>;
}
