"use client";

import { Heart, Play, WandSparkles } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { UnifiedMusicList } from "@/components/music/unified-music-list";
import { useSpotifyLikes } from "@/hooks/use-spotify-likes";
import { SpotifyTrack } from "@/types/spotify-track";
import { RecommendationDislikeButton } from "@/components/recommendation/dislike-button";

export function SpotifyMusicList({ tracks, onPlay, onRecommend, onLikedChanged, showFeedback = false }: {
  tracks: SpotifyTrack[];
  onPlay: (track: SpotifyTrack, index: number) => void;
  onRecommend: (track: SpotifyTrack) => void;
  onLikedChanged?: (track: SpotifyTrack, liked: boolean) => void;
  showFeedback?: boolean;
}) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const likes = useSpotifyLikes(tracks.map((track) => track.id));
  async function toggle(track: SpotifyTrack) {
    const liked = await likes.toggle(track.id);
    if (liked !== null) onLikedChanged?.(track, liked);
  }
  function actions(track: SpotifyTrack, _index: number, showPlay: boolean) {
    const liked = likes.liked.has(track.id);
    return <div className="flex shrink-0 items-center gap-1">
      {showFeedback && <RecommendationDislikeButton source="Spotify" id={track.id} name={track.name} onDislike={() => setDismissed((previous) => [...previous, track.id])} />}
      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-purple-500" title={t("recommend_from_song", { name: track.name })} aria-label={t("recommend_from_song", { name: track.name })} onClick={(event) => { event.stopPropagation(); onRecommend(track); }}><WandSparkles className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={t(liked ? "unlike_song" : "like_song", { name: track.name })} onClick={(event) => { event.stopPropagation(); void toggle(track); }}><Heart className={`h-4 w-4 ${liked ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} /></Button>
      {showPlay && <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={t("play_song", { name: track.name })} onClick={(event) => { event.stopPropagation(); onPlay(track, tracks.findIndex((candidate) => candidate.id === track.id)); }}><Play className="h-4 w-4" /></Button>}
    </div>;
  }
  return <>
    {likes.error && <p role="alert" className="text-sm text-destructive">{likes.error}</p>}
    <UnifiedMusicList items={tracks.filter((track) => !dismissed.includes(track.id))} row={(track, index) => ({
      key: `${track.id}-${index}`,
      name: track.name,
      artist: track.artists.map((artist) => artist.name).join(", "),
      album: track.album?.name ?? "",
      style: t("song_style_unknown"),
      releaseDate: track.album?.release_date ?? "",
      durationMs: track.duration_ms,
      imageUrl: track.album?.images?.[0]?.url,
    })} actions={actions} onPlay={(track) => onPlay(track, tracks.findIndex((candidate) => candidate.id === track.id))} />
  </>;
}
