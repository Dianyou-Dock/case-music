"use client";

import { useEffect, useState } from "react";
import { Clock, Heart, Play, WandSparkles } from "lucide-react";
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
import { useTranslation } from "react-i18next";

interface MusicListProps {
  songs: SongInfo[];
  onRecommend?: (song: SongInfo) => void;
}

export function MusicList({ songs, onRecommend }: MusicListProps) {
  const { currentSource } = useAudioSource();
  const { t } = useTranslation();
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
      draft.isPlaying = true;
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

  function renderActions(track: SongInfo, showPlay: boolean) {
    const isLiked = likes.includes(track.content.id);

    return (
      <div className="flex shrink-0 items-center gap-1">
        {onRecommend && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-purple-500"
            title={t("recommend_from_song", { name: track.content.name })}
            aria-label={t("recommend_from_song", { name: track.content.name })}
            onClick={(event) => {
              event.stopPropagation();
              onRecommend(track);
            }}
          >
            <WandSparkles className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          aria-label={t(isLiked ? "unlike_song" : "like_song", {
            name: track.content.name,
          })}
          onClick={(event) => {
            event.stopPropagation();
            handleHeartClick(track.content.id, isLiked);
          }}
        >
          <Heart
            className={`h-4 w-4 ${
              isLiked
                ? "fill-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          />
        </Button>
        {showPlay && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label={t("play_song", { name: track.content.name })}
            onClick={(event) => {
              event.stopPropagation();
              handlePlayClick(track);
            }}
          >
            <Play className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="w-full min-w-0 lg:hidden">
        {songs.map((track) => (
          <div
            key={track.content.id}
            className="flex w-full min-w-0 items-center gap-2 border-b py-2"
            onClick={() => handlePlayClick(track)}
          >
            <img
              src={track.content.pic_url}
              alt=""
              className="h-10 w-10 shrink-0 rounded object-cover"
            />
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="truncate font-medium">{track.content.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {track.content.singer}
              </p>
            </div>
            {renderActions(track, false)}
          </div>
        ))}
      </div>
      <div className="hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("song_title")}</TableHead>
              <TableHead>{t("song_artist")}</TableHead>
              <TableHead>{t("song_album")}</TableHead>
              <TableHead className="w-[100px]">
                <Clock className="h-4 w-4" />
              </TableHead>
              <TableHead
                className={onRecommend ? "w-[144px]" : "w-[108px]"}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {songs.map((track) => (
              <TableRow
                key={track.content.id}
                onClick={() => handlePlayClick(track)}
              >
                <TableCell>
                  <div className="flex min-w-0 items-center gap-3 pr-6">
                    <img
                      src={track.content.pic_url}
                      alt={track.content.name}
                      className="h-10 w-10 shrink-0 rounded object-cover"
                    />
                    <span className="min-w-0 truncate font-medium">
                      {track.content.name}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{track.content.singer}</TableCell>
                <TableCell>{track.content.album}</TableCell>
                <TableCell>{formatDuration(track.content.duration)}</TableCell>
                <TableCell>{renderActions(track, true)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
