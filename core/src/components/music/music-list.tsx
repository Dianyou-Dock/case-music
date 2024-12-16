"use client";

import { useEffect, useState } from "react";
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
import { invoke } from "@tauri-apps/api/core";
import { ApplicationResp } from "@/types/application.ts";
import { useAudioSource } from "@/hooks/use-audio-source";

interface MusicListProps {
  songs: SongInfo[];
}

export function MusicList({ songs }: MusicListProps) {
  const { currentSource } = useAudioSource();
  const [likes, setLikes] = useState<number[]>([]);

  useEffect(() => {
    if (songs) {
      setLikes(songs.map((item) => item.content.id));
    }
  }, [songs]);

  function handlePlayClick(song: SongInfo) {
    playerControl.set.state((draft) => {
      draft.immediately = song;
    });
  }

  async function handleHeartClick(id: number, liked: boolean) {
    const newLiked = !liked;

    // update local state
    if (newLiked) {
      setLikes([...likes, id]);
    } else {
      setLikes(likes.filter((item) => item !== id));
    }

    await invoke<ApplicationResp<boolean>>("like_song", {
      req: { source: currentSource, song_id: id, is_like: newLiked },
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
                      likes.includes(track.content.id)
                        ? "fill-primary text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() =>
                      handleHeartClick(
                        track.content.id,
                        likes.includes(track.content.id)
                      )
                    }
                  />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Play
                    className="h-4 w-4"
                    onClick={() => {
                      handlePlayClick(track, likes.includes(track.content.id));
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
