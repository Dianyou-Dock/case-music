"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { ApplicationResp } from "@/types/application";
import { parseLyrics } from "@/lib/lyrics";
import { formatProgress } from "@/lib/format";
import playerControl from "@/store/player-control";
import { PlayQueue } from "@/components/play-queue";
import { useSpotifyPlayback } from "@/hooks/use-spotify-playback";
import { SpotifyMobilePlayer } from "@/components/spotify/spotify-mobile-player";
import { NetEasePlayerHeart } from "@/components/music/netease-player-heart";

type Lyrics = { lyric: string[]; tlyric: string[] };

export function MobilePlayer() {
  const spotify = useSpotifyPlayback();
  const { t } = useTranslation();
  const currentTrack = playerControl.useTracked.currentSong();
  const isPlaying = playerControl.useTracked.isPlaying();
  const progress = playerControl.useTracked.progress();
  const duration = playerControl.useTracked.duration();
  const [open, setOpen] = useState(false);
  const [lyrics, setLyrics] = useState<Lyrics>({ lyric: [], tlyric: [] });
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const lyricLines = useMemo(() => parseLyrics(lyrics.lyric, lyrics.tlyric), [lyrics]);
  const seekMax = Math.max(duration, 1);
  const position = Math.min(Math.max(progress, 0), seekMax);
  const percent = Math.min((position / seekMax) * 100, 100);

  useEffect(() => {
    if (!open || !currentTrack) return;
    let active = true;
    setLyrics({ lyric: [], tlyric: [] });
    setLyricsLoading(true);
    invoke<ApplicationResp<Lyrics>>("song_lyrics", {
      req: { source: currentTrack.type, song_id: currentTrack.content.id },
    }).then((response) => {
      if (active) setLyrics(response.data || { lyric: [], tlyric: [] });
    }).catch(() => {
      if (active) setLyrics({ lyric: [], tlyric: [] });
    }).finally(() => {
      if (active) setLyricsLoading(false);
    });
    return () => { active = false; };
  }, [open, currentTrack?.content.id, currentTrack?.type]);

  if (spotify.active) return <SpotifyMobilePlayer />;
  if (!currentTrack) return null;

  let activeLine = -1;
  for (let index = 0; index < lyricLines.length; index++) {
    if (lyricLines[index].time <= progress) activeLine = index;
  }

  const togglePlayback = () => {
    if (isPlaying) playerControl.set.pause();
    else playerControl.set.play();
  };

  return (
    <>
      <div className="relative shrink-0 border-t bg-background pb-2 pt-2 md:hidden">
        <div className="flex min-w-0 items-center gap-2 px-3">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            onClick={() => setOpen(true)}
            aria-label={t("player_open")}
          >
            <img src={currentTrack.content.pic_url} alt="" className="h-11 w-11 shrink-0 rounded-md object-cover" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{currentTrack.content.name}</span>
              <span className="block truncate text-sm text-muted-foreground">{currentTrack.content.singer}</span>
            </span>
          </button>
          <NetEasePlayerHeart />
          <Button variant="ghost" size="icon" onClick={togglePlayback} aria-label={t(isPlaying ? "player_pause" : "player_play")}>
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => playerControl.set.next()} aria-label={t("player_next")}>
            <SkipForward className="h-5 w-5" />
          </Button>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-muted" aria-hidden="true">
          <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
        <input
          type="range"
          min={0}
          max={seekMax}
          step={1}
          value={position}
          onChange={(event) => playerControl.set.seek(Number(event.target.value))}
          className="absolute inset-x-0 bottom-0 h-3 w-full cursor-pointer opacity-0"
          aria-label={t("player_seek")}
        />
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="h-[100dvh] overflow-hidden p-0 [&>button]:hidden">
          <SheetTitle className="sr-only">{t("player_now_playing")}</SheetTitle>
          <div className="flex h-full min-h-0 flex-col px-6 pb-8 pt-14">
            <div className="mb-5 flex shrink-0 items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label={t("player_close")}>
                <ChevronDown className="h-7 w-7" />
              </Button>
              <span className="text-sm font-medium text-muted-foreground">{t("player_now_playing")}</span>
              <PlayQueue />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6">
              <img
                src={currentTrack.content.pic_url}
                alt={currentTrack.content.album || currentTrack.content.name}
                className="mx-auto aspect-square max-w-full rounded-xl object-cover shadow-lg"
                style={{ width: "min(76vw, 38dvh, 360px)" }}
              />
              <div className="mt-5 text-center">
                <div className="flex items-center justify-center gap-2"><h2 className="truncate text-xl font-semibold">{currentTrack.content.name}</h2><NetEasePlayerHeart /></div>
                <p className="truncate text-muted-foreground">{currentTrack.content.singer}</p>
              </div>
              <div className="mt-7 space-y-4 text-center" aria-label={t("player_lyrics")}>
                {lyricsLoading ? (
                  <p className="text-muted-foreground">{t("lyrics_loading")}</p>
                ) : lyricLines.length === 0 ? (
                  <p className="text-muted-foreground">{t("no_lyrics")}</p>
                ) : lyricLines.map((line, index) => (
                  <button
                    type="button"
                    key={`${line.time}-${index}`}
                    className={`block w-full rounded px-2 py-1 text-center ${index === activeLine ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                    onClick={() => playerControl.set.seek(line.time)}
                  >
                    <span className="block">{line.text}</span>
                    {line.translation && <span className="mt-1 block text-sm opacity-75">{line.translation}</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className="shrink-0 border-t pt-4">
              <Slider
                value={[position]}
                max={seekMax}
                step={1}
                onValueChange={(value) => playerControl.set.seek(value[0])}
                aria-label={t("player_seek")}
              />
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{formatProgress(progress)}</span>
                <span>{formatProgress(duration)}</span>
              </div>
              <div className="mt-4 flex items-center justify-center gap-12">
                <Button variant="ghost" size="icon" onClick={() => playerControl.set.back()} aria-label={t("player_previous")}>
                  <SkipBack className="h-7 w-7" />
                </Button>
                <Button size="icon" className="h-14 w-14 rounded-full" onClick={togglePlayback} aria-label={t(isPlaying ? "player_pause" : "player_play")}>
                  {isPlaying ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => playerControl.set.next()} aria-label={t("player_next")}>
                  <SkipForward className="h-7 w-7" />
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
