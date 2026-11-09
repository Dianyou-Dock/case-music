"use client";

import { useState } from "react";
import { Heart, ListPlus, Play, WandSparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { UnifiedMusicList } from "@/components/music/unified-music-list";
import { RecommendationDislikeButton } from "@/components/recommendation/dislike-button";
import { useQqLikes } from "@/hooks/use-qq-likes";
import { QqSong, useQqPlayback } from "@/hooks/use-qq-playback";
import { recordSourceRecommendationFeedback } from "@/lib/recommendation-feedback";
import { recordRecommendationVote } from "@/store/recommendation-task";

export function QqMusicList({ songs, onRecommend, showFeedback = false, knownLiked = false, recommendationId }: {
  songs: QqSong[];
  onRecommend?: (song: QqSong) => void;
  showFeedback?: boolean;
  knownLiked?: boolean;
  recommendationId?: string;
}) {
  const { t } = useTranslation();
  const player = useQqPlayback();
  const likes = useQqLikes(songs.map((song) => song.id), knownLiked);
  const [dismissed, setDismissed] = useState<string[]>([]);

  async function toggle(song: QqSong) {
    const liked = await likes.toggle(song.id);
    if (liked) recordSourceRecommendationFeedback("QQ", song.id, "liked");
    if (liked !== null && recommendationId) recordRecommendationVote(recommendationId, song.id, liked ? "liked" : null);
  }

  return <>
    {likes.error && <p role="alert" className="text-sm text-destructive">{likes.error}</p>}
    <UnifiedMusicList
      items={songs.filter((song) => !dismissed.includes(song.id))}
      row={(song) => ({ key: song.id, name: song.name, artist: song.artists.map((artist) => artist.name).join("、"), album: song.album.name, style: t("song_style_unknown"), releaseDate: song.release_date ?? "", durationMs: song.duration_ms ?? 0, imageUrl: song.pic_url })}
      actions={(song, _index, showPlay) => <div className="flex shrink-0 items-center gap-1">
        {showFeedback && <RecommendationDislikeButton source="QQ" id={song.id} name={song.name} artist={song.artists[0]?.name} onDislike={() => { setDismissed((previous) => [...previous, song.id]); if (recommendationId) recordRecommendationVote(recommendationId, song.id, "disliked"); }} />}
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={t("queue_add", { name: song.name })} title={t("queue_add", { name: song.name })} onClick={(event) => { event.stopPropagation(); player.enqueue(song); }}><ListPlus className="h-4 w-4" /></Button>
        {onRecommend && <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-purple-500" aria-label={t("recommend_from_song", { name: song.name })} title={t("recommend_from_song", { name: song.name })} onClick={(event) => { event.stopPropagation(); onRecommend(song); }}><WandSparkles className="h-4 w-4" /></Button>}
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" disabled={likes.pending.has(song.id)} aria-label={t(likes.liked.has(song.id) ? "unlike_song" : "like_song", { name: song.name })} onClick={(event) => { event.stopPropagation(); void toggle(song); }}><Heart className={`h-4 w-4 ${likes.liked.has(song.id) ? "fill-primary text-primary" : "text-muted-foreground hover:text-foreground"}`} /></Button>
        {showPlay && <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={t("play_song", { name: song.name })} onClick={(event) => { event.stopPropagation(); void player.play(songs, songs.findIndex((item) => item.id === song.id)); }}><Play className="h-4 w-4" /></Button>}
      </div>}
      onPlay={(song) => void player.play(songs, songs.findIndex((item) => item.id === song.id))}
    />
  </>;
}
