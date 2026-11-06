"use client";

import { ReactNode } from "react";
import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDuration } from "@/lib/format";

export type MusicListRow = {
  key: string;
  name: string;
  artist: string;
  album: string;
  style: string;
  releaseDate: ReactNode;
  durationMs: number;
  imageUrl?: string;
};

export function UnifiedMusicList<T>({ items, row, actions, onPlay }: {
  items: T[];
  row: (item: T, index: number) => MusicListRow;
  actions: (item: T, index: number, showPlay: boolean) => ReactNode;
  onPlay: (item: T, index: number) => void;
}) {
  const { t } = useTranslation();
  return <>
    <div className="w-full min-w-0 lg:hidden">{items.map((item, index) => {
      const track = row(item, index);
      return <div key={track.key} className="flex w-full min-w-0 items-center gap-2 border-b py-2" onClick={() => onPlay(item, index)}>
        {track.imageUrl && <img src={track.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />}
        <div className="min-w-0 flex-1 overflow-hidden"><p className="truncate font-medium">{track.name}</p><p className="truncate text-xs text-muted-foreground">{track.artist} · {track.style} · {track.releaseDate}</p></div>
        {actions(item, index, false)}
      </div>;
    })}</div>
    <div className="hidden lg:block"><Table><TableHeader><TableRow>
      <TableHead>{t("song_title")}</TableHead><TableHead>{t("song_artist")}</TableHead><TableHead>{t("song_album")}</TableHead><TableHead>{t("song_style")}</TableHead><TableHead>{t("song_release_date")}</TableHead><TableHead className="w-[100px]"><Clock className="h-4 w-4" /></TableHead><TableHead className="w-[144px]" />
    </TableRow></TableHeader><TableBody>{items.map((item, index) => {
      const track = row(item, index);
      return <TableRow key={track.key} onClick={() => onPlay(item, index)}>
        <TableCell><div className="flex min-w-0 items-center gap-3 pr-6">{track.imageUrl && <img src={track.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />}<span className="min-w-0 truncate font-medium">{track.name}</span></div></TableCell>
        <TableCell>{track.artist}</TableCell><TableCell>{track.album}</TableCell><TableCell>{track.style}</TableCell><TableCell>{track.releaseDate}</TableCell><TableCell>{formatDuration(track.durationMs)}</TableCell><TableCell>{actions(item, index, true)}</TableCell>
      </TableRow>;
    })}</TableBody></Table></div>
  </>;
}
