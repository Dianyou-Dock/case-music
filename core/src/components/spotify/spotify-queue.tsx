"use client";

import { ArrowLeft, ListMusic } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useSpotifyPlayback } from "@/hooks/use-spotify-playback";
import { useEdgeSwipeBack } from "@/hooks/use-edge-swipe-back";

export function SpotifyQueue() {
  const { t } = useTranslation();
  const { queue, track } = useSpotifyPlayback();
  const [open, setOpen] = useState(false);
  const swipeBack = useEdgeSwipeBack(() => setOpen(false), open);
  return <Sheet open={open} onOpenChange={setOpen}>
    <SheetTrigger asChild><Button variant="ghost" size="icon" aria-label={t("play_queue")} title={t("play_queue")}><ListMusic className="h-5 w-5" /></Button></SheetTrigger>
    <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md [&>button]:hidden" {...swipeBack}>
      <div className="flex items-center gap-1 border-b px-3 py-3">
        <Button variant="ghost" size="icon" className="border border-white" onClick={() => setOpen(false)} aria-label={t("queue_back")}><ArrowLeft className="h-5 w-5" /></Button>
        <SheetTitle>{t("play_queue")} · {queue.length}</SheetTitle>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {queue.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">{t("queue_empty")}</p>}
        {queue.map((song, index) => <div key={`${song.id}-${index}`} className={`flex items-center gap-3 border-b px-5 py-2 ${song.id === track?.id ? "bg-accent" : ""}`}>
          {song.album?.images?.[0]?.url && <img src={song.album.images[0].url} alt="" className="h-10 w-10 rounded object-cover" />}
          <div className="min-w-0"><p className="truncate font-medium">{song.name}</p><p className="truncate text-xs text-muted-foreground">{song.artists?.map((artist) => artist.name).join(", ")}</p></div>
        </div>)}
      </div>
    </SheetContent>
  </Sheet>;
}
