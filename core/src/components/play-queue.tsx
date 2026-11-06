"use client";

import { ArrowLeft, ListMusic, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import playerControl from "@/store/player-control";
import { useEdgeSwipeBack } from "@/hooks/use-edge-swipe-back";

export function PlayQueue() {
  const { t } = useTranslation();
  const songs = playerControl.useTracked.songs();
  const index = playerControl.useTracked.index();
  const immediately = playerControl.useTracked.immediately();
  const [open, setOpen] = useState(false);
  const swipeBack = useEdgeSwipeBack(() => setOpen(false), open);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("play_queue")} title={t("play_queue")}>
          <ListMusic className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md [&>button]:hidden" {...swipeBack}>
        <div className="flex items-center justify-between gap-2 border-b px-3 py-3">
          <div className="flex min-w-0 items-center gap-1">
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setOpen(false)} aria-label={t("queue_back")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <SheetTitle className="truncate">{t("play_queue")} · {songs.length + (immediately ? 1 : 0)}</SheetTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={() => playerControl.set.clear()} disabled={songs.length === 0 && !immediately}>
            <Trash2 className="mr-2 h-4 w-4" />{t("queue_clear")}
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {songs.length === 0 && !immediately && <p className="p-6 text-center text-sm text-muted-foreground">{t("queue_empty")}</p>}
          {immediately && (
            <div className="flex items-center gap-3 border-b px-5 py-3 bg-accent">
              <img src={immediately.content.pic_url} alt="" className="h-10 w-10 rounded object-cover" />
              <div className="min-w-0 flex-1"><p className="truncate font-medium">{immediately.content.name}</p><p className="truncate text-xs text-muted-foreground">{t("player_now_playing")} · {immediately.content.singer}</p></div>
            </div>
          )}
          {songs.map((song, songIndex) => (
            <div key={`${song.type}-${song.content.id}-${songIndex}`} className={`flex items-center gap-3 border-b px-5 py-2 ${songIndex === index && !immediately ? "bg-accent" : ""}`}>
              <button type="button" onClick={() => playerControl.set.select(songIndex)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={t("play_song", { name: song.content.name })}>
                <img src={song.content.pic_url} alt="" className="h-10 w-10 rounded object-cover" />
                <span className="min-w-0"><span className="block truncate font-medium">{song.content.name}</span><span className="block truncate text-xs text-muted-foreground">{song.content.singer}</span></span>
              </button>
              <Button variant="ghost" size="icon" onClick={() => playerControl.set.remove(songIndex)} aria-label={t("queue_remove", { name: song.content.name })}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
