"use client";

import { useEffect, useState } from "react";
import { Heart, ListPlus, Play, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SongInfo } from "@/types/song.ts";
import playerControl from "@/store/player-control";
import { invoke } from "@tauri-apps/api/core";
import { ApplicationResp } from "@/types/application.ts";
import { useAudioSource } from "@/hooks/use-audio-source";
import { useTranslation } from "react-i18next";
import { recordRecommendationFeedback } from "@/lib/recommendation-feedback";
import { ReleaseDate } from "@/components/music/release-year";
import { UnifiedMusicList } from "@/components/music/unified-music-list";
import { RecommendationDislikeButton } from "@/components/recommendation/dislike-button";
import { recordRecommendationVote } from "@/store/recommendation-task";

interface MusicListProps {
  songs: SongInfo[];
  onRecommend?: (song: SongInfo) => void;
  showFeedback?: boolean;
  recommendationId?: string;
}

export function MusicList({ songs, onRecommend, showFeedback = false, recommendationId }: MusicListProps) {
  const { currentSource } = useAudioSource();
  const { t } = useTranslation();
  const [likes, setLikes] = useState<number[]>([]);
  const [dismissed, setDismissed] = useState<number[]>([]);

  useEffect(() => {
    if (songs) {
      setLikes(
        songs.filter((item) => item.liked).map((item) => item.content.id)
      );
    }
  }, [songs]);

  function handlePlayClick(song: SongInfo) {
    const songIndex = songs.findIndex((item) => item.type === song.type && item.content.id === song.content.id);
    if (songIndex < 0) return;
    playerControl.set.state((draft) => {
      draft.songs = songs;
      draft.index = songIndex;
      draft.restartKey++;
      draft.immediately = undefined;
      draft.isPlaying = true;
    });
  }

  async function handleHeartClick(id: number, liked: boolean) {
    const newLiked = !liked;

    // update local state
    if (newLiked) {
      setLikes([...likes, id]);
      const song = songs.find((item) => item.content.id === id);
      if (song) recordRecommendationFeedback(song, "liked");
    } else {
      setLikes(likes.filter((item) => item !== id));
    }

    const response = await invoke<ApplicationResp<boolean>>("like_song", {
      req: { source: currentSource, song_id: id, is_like: newLiked },
    });
    if (response.code === 0 && recommendationId) recordRecommendationVote(recommendationId, id, newLiked ? "liked" : null);
  }

  function renderActions(track: SongInfo, showPlay: boolean) {
    const isLiked = likes.includes(track.content.id);

    return (
      <div className="flex shrink-0 items-center gap-1">
        {showFeedback && <RecommendationDislikeButton source={track.type} id={track.content.id} name={track.content.name} artist={track.content.singer} onDislike={() => { setDismissed((previous) => [...previous, track.content.id]); if (recommendationId) recordRecommendationVote(recommendationId, track.content.id, "disliked"); }} />}
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={t("queue_add", { name: track.content.name })} title={t("queue_add", { name: track.content.name })} onClick={(event) => { event.stopPropagation(); playerControl.set.enqueue(track); }}>
          <ListPlus className="h-4 w-4" />
        </Button>
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

  return <UnifiedMusicList
    items={songs.filter((track) => !dismissed.includes(track.content.id))}
    row={(track) => ({
      key: `${track.type}-${track.content.id}`,
      name: track.content.name,
      artist: track.content.singer,
      album: track.content.album,
      style: track.song_type || t("song_style_unknown"),
      releaseDate: <ReleaseDate albumId={track.content.album_id} date={track.release_date} />,
      durationMs: track.content.duration,
      imageUrl: track.content.pic_url,
    })}
    actions={(track, _index, showPlay) => renderActions(track, showPlay)}
    onPlay={handlePlayClick}
  />;
}
