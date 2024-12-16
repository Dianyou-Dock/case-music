"use client";

import { Clock, Heart, MoreHorizontal, Play } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/format";
import { SongInfo } from "@/types/song.ts";
import playerControl from "@/store/player-control";

interface MusicListProps {
  songs: SongInfo[];
}

export function MusicList({ songs }: MusicListProps) {
  function handlePlayClick(song: SongInfo) {
    playerControl.set.state((draft) => {
      draft.immediately = song;
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Artist</TableHead>
          <TableHead>Album</TableHead>
          <TableHead className="w-[100px]">
            <Clock className="h-4 w-4" />
          </TableHead>
          <TableHead className="w-[100px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {songs.map((track) => (
          <TableRow key={track.content.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <img
                  src={track.content.pic_url}
                  alt={track.content.name}
                  className="h-10 w-10 rounded object-cover"
                />
                <span className="font-medium">{track.content.name}</span>
              </div>
            </TableCell>
            <TableCell>{track.content.singer}</TableCell>
            <TableCell>{track.content.album}</TableCell>
            <TableCell>{formatDuration(track.content.duration)}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Heart
                    className={`h-4 w-4 ${
                      true
                        ? "fill-primary text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => {}}
                  />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Play
                    className="h-4 w-4"
                    onClick={() => {
                      handlePlayClick(track);
                    }}
                  />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
