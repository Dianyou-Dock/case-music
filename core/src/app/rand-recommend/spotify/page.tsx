"use client";

import { Suspense, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { GenerateRecommendationButton } from "@/components/recommendation/generate-button";
import { RecommendationHistoryList } from "@/components/recommendation/history-list";
import { PlaylistSkeleton } from "@/components/playlist-skeleton";
import { MusicHeader } from "@/components/music/music-header";
import { SpotifyMusicList } from "@/components/spotify/spotify-music-list";
import { useSpotifyPlayback } from "@/hooks/use-spotify-playback";
import { useRecommendationRoute } from "@/hooks/use-recommendation-route";
import { SpotifyTrack } from "@/types/spotify-track";
import { hydrateRecommendationState, startRandomRecommendation, startSampleRecommendation, useRecommendationState } from "@/store/recommendation-task";

function SpotifyRecommendationContent() {
  const { t, i18n } = useTranslation();
  const spotify = useSpotifyPlayback();
  const { task, history, hydrated } = useRecommendationState();
  const records = history.filter((record) => record.source === "Spotify");
  const route = useRecommendationRoute("Spotify", records);
  const selected = route.record;
  const pending = task.source === "Spotify" && task.runId === route.pendingId ? task : null;
  const songs = selected?.spotifySongs ?? [];
  const [playError, setPlayError] = useState("");

  useEffect(() => hydrateRecommendationState(), []);

  function generate() { route.openPending(startRandomRecommendation("Spotify", true)); }
  function recommendFrom(song: SpotifyTrack) {
    route.openPending(startSampleRecommendation("Spotify", song.name, song.artists[0]?.name ?? "", song.id));
  }
  function retry() {
    if (pending?.kind === "sample" && pending.seedTrackId) {
      route.openPending(startSampleRecommendation("Spotify", pending.song ?? "", pending.singer ?? "", pending.seedTrackId));
    } else generate();
  }
  function refreshRecord() {
    if (selected?.kind === "sample" && selected.seedTrackId) {
      route.openPending(startSampleRecommendation("Spotify", selected.song ?? "", selected.singer ?? "", selected.seedTrackId));
    } else generate();
  }
  async function playFrom(index: number) {
    setPlayError("");
    try {
      const queue = songs.slice(index);
      await spotify.play({ trackIds: queue.map((song) => song.id), queueTracks: queue });
    } catch (cause) { setPlayError(String(cause)); }
  }

  if (!hydrated) return <PlaylistSkeleton />;

  return <div className="flex flex-col gap-6 p-6">
    <Button variant="ghost" className="self-start gap-2" onClick={route.back}><ArrowLeft className="h-4 w-4" />{route.isDetail || route.isPending ? t("recommend_history") : t("rand_recommend")}</Button>
    {route.isDetail && selected ? <>
      <p className="text-sm text-muted-foreground">{new Date(selected.completedAt).toLocaleString(i18n.language)} · {t("song_count", { count: songs.length })}</p>
      {playError && <p role="alert" className="text-sm text-destructive">{playError}</p>}
      {!spotify.ready && <p className="text-sm text-muted-foreground">{spotify.error || t("spotify_sdk_loading")}</p>}
      {songs.length > 0 && <>
        <MusicHeader title={selected.kind === "sample" ? t("song_recommend_sample", { song: selected.song, singer: selected.singer }) : t("rand_recommend_title")} subtitle={t("song_count", { count: songs.length })} coverUrl={songs[0]?.album?.images?.[0]?.url} handlePlayAllClick={() => void playFrom(0)} handleRefreshClick={refreshRecord} />
        <SpotifyMusicList tracks={songs} onPlay={(_song, index) => void playFrom(index)} onRecommend={recommendFrom} showFeedback />
      </>}
      {songs.length === 0 && <p className="text-muted-foreground">{t("recommend_empty")}</p>}
    </> : route.isPending ? <>
      <h1 className="text-2xl font-bold">{pending?.kind === "sample" ? t("song_recommend_title") : t("rand_recommend_title")}</h1>
      {pending?.status === "error" ? <div role="alert" className="space-y-3 rounded-lg border border-destructive p-4"><p>{t("recommend_failed")}: {pending.error === "recommend_interrupted" ? t(pending.error) : pending.error}</p><GenerateRecommendationButton label={t("qr_retry")} onClick={retry} /></div> : <div role="status"><p className="text-muted-foreground">{pending?.kind === "sample" ? t("song_recommend_loading", { song: pending.song }) : t("playlist_loading_more")}</p><PlaylistSkeleton /></div>}
    </> : <>
      <div className="flex items-center justify-between gap-3"><h1 className="text-2xl font-bold">{t("recommend_history")}</h1><GenerateRecommendationButton label={t("rand_recommend")} onClick={generate} /></div>
      {records.length > 0 ? <RecommendationHistoryList records={records} onSelect={route.openRecord} hideTitle /> : <p className="text-muted-foreground">{t("recommend_history_empty")}</p>}
    </>}
  </div>;
}

export default function SpotifyRecommendationPage() {
  return <Suspense fallback={<PlaylistSkeleton />}><SpotifyRecommendationContent /></Suspense>;
}
