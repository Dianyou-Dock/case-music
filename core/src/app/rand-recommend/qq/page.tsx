"use client";

import { Suspense, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { MusicHeader } from "@/components/music/music-header";
import { QqMusicList } from "@/components/music/qq-music-list";
import { PlaylistSkeleton } from "@/components/playlist-skeleton";
import { GenerateRecommendationButton } from "@/components/recommendation/generate-button";
import { RecommendationHistoryList } from "@/components/recommendation/history-list";
import { useAudioSource } from "@/hooks/use-audio-source";
import { useQqPlayback } from "@/hooks/use-qq-playback";
import { useRecommendationRoute } from "@/hooks/use-recommendation-route";
import { hydrateRecommendationState, startRandomRecommendation, startSampleRecommendation, useRecommendationState } from "@/store/recommendation-task";
import { QqSong } from "@/hooks/use-qq-playback";

function QqRecommendationContent() {
  const { t, i18n } = useTranslation();
  const { audioSource } = useAudioSource();
  const player = useQqPlayback();
  const { task, history, hydrated } = useRecommendationState();
  const records = history.filter((record) => record.source === "QQ");
  const route = useRecommendationRoute("QQ", records);
  const selected = route.record;
  const pending = task.source === "QQ" && task.runId === route.pendingId ? task : null;
  const songs = selected?.qqSongs ?? [];

  useEffect(() => hydrateRecommendationState(), []);
  const generate = () => route.openPending(startRandomRecommendation("QQ", true));
  const recommend = (song: QqSong) => route.openPending(startSampleRecommendation("QQ", song.name, song.artists[0]?.name ?? "", String(song.qq_id ?? "")));
  const refresh = () => selected?.kind === "sample" && selected.seedTrackId
    ? route.openPending(startSampleRecommendation("QQ", selected.song ?? "", selected.singer ?? "", selected.seedTrackId))
    : generate();
  const retry = () => pending?.kind === "sample" && pending.seedTrackId
    ? route.openPending(startSampleRecommendation("QQ", pending.song ?? "", pending.singer ?? "", pending.seedTrackId))
    : generate();
  if (!hydrated || audioSource === null) return <PlaylistSkeleton />;
  const connected = audioSource.some((source) => source.id === "QQ" && source.connected);

  return <div className="flex flex-col gap-6 p-6">
    <Button variant="ghost" className="self-start gap-2" onClick={route.back}><ArrowLeft className="h-4 w-4" />{route.isDetail || route.isPending ? t("recommend_history") : t("rand_recommend")}</Button>
    {!connected ? <p className="text-muted-foreground">{t("recommend_music_source_required")}</p> : route.isDetail && selected ? <>
      <p className="text-sm text-muted-foreground">{new Date(selected.completedAt).toLocaleString(i18n.language)} · {t("song_count", { count: songs.length })}</p>
      {songs.length > 0 ? <><MusicHeader title={selected.kind === "sample" ? t("song_recommend_sample", { song: selected.song, singer: selected.singer }) : t("rand_recommend_title")} subtitle={t("song_count", { count: songs.length })} coverUrl={selected.coverUrl} handlePlayAllClick={() => void player.play(songs, 0)} handleRefreshClick={refresh} /><QqMusicList songs={songs} onRecommend={recommend} showFeedback /></> : <p className="text-muted-foreground">{t("recommend_empty")}</p>}
    </> : route.isPending ? <>
      <h1 className="text-2xl font-bold">{t("rand_recommend_title")}</h1>
      {pending?.status === "error" ? <div role="alert" className="space-y-3 rounded-lg border border-destructive p-4"><p>{t("recommend_failed")}: {pending.error}</p><GenerateRecommendationButton label={t("qr_retry")} onClick={retry} /></div> : <PlaylistSkeleton />}
    </> : <>
      <div className="flex items-center justify-between gap-3"><h1 className="text-2xl font-bold">{t("recommend_history")}</h1><GenerateRecommendationButton label={t("rand_recommend")} onClick={generate} /></div>
      <RecommendationHistoryList records={records} onSelect={route.openRecord} hideTitle />
    </>}
  </div>;
}

export default function QqRecommendationPage() {
  return <Suspense fallback={<PlaylistSkeleton />}><QqRecommendationContent /></Suspense>;
}
