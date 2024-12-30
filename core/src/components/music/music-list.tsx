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
  const songsStore = playerControl.useTracked.songs();

  useEffect(() => {
    if (songs) {
      setLikes(
        songs.filter((item) => item.liked).map((item) => item.content.id)
      );
    }
  }, [songs]);

  function handlePlayClick(song: SongInfo) {
    if (songsStore.length === 0) {
      playerControl.set.songs([song]);
      playerControl.set.index(0);
      playerControl.set.play();
      return;
    }
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
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="hidden md:table-cell">Title</TableHead>
            <TableHead className="hidden md:table-cell">Artist</TableHead>
            <TableHead className="hidden md:table-cell">Album</TableHead>
            <TableHead className="hidden sm:table-cell w-[100px]">
              <Clock className="h-4 w-4" />
            </TableHead>
            <TableHead className="w-[100px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {songs.map((track) => (
            <TableRow
              key={track.content.id}
              onClick={() => handlePlayClick(track)}
            >
              <TableCell>
                <div className="flex items-center gap-3 pr-6">
                  <img
                    src={track.content.pic_url}
                    alt={track.content.name}
                    className="h-10 w-10 rounded object-cover"
                  />
                  <span className="font-medium min-w-24">
                    {track.content.name}
                  </span>
                </div>
              </TableCell>
              <TableCell>{track.content.singer}</TableCell>
              <TableCell className="hidden md:table-cell">
                {track.content.album}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {formatDuration(track.content.duration)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Heart
                      className={`h-4 w-4 ${
                        likes.includes(track.content.id)
                          ? "fill-primary text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleHeartClick(
                          track.content.id,
                          likes.includes(track.content.id)
                        );
                      }}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hidden md:table-cell"
                  >
                    <Play
                      className="h-4 w-4"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayClick(track);
                      }}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hidden"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
