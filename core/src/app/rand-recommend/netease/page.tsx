"use client";

import { Suspense, useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAudioSource } from "@/hooks/use-audio-source";
import { useRecommendationRoute } from "@/hooks/use-recommendation-route";
import { MusicList } from "@/components/music/music-list";
import { MusicHeader } from "@/components/music/music-header";
import { PlaylistSkeleton } from "@/components/playlist-skeleton";
import { Button } from "@/components/ui/button";
import { GenerateRecommendationButton } from "@/components/recommendation/generate-button";
import { RecommendationHistoryList } from "@/components/recommendation/history-list";
import { SongInfo } from "@/types/song";
import playerControl from "@/store/player-control";
import { hydrateRecommendationState, startRandomRecommendation, startSampleRecommendation, useRecommendationState } from "@/store/recommendation-task";

function NetEaseRecommendationContent() {
  const { audioSource } = useAudioSource();
  const connected = audioSource?.some((source) => source.id === "Netesae" && source.connected);
  const { t, i18n } = useTranslation();
  const { task, history, hydrated } = useRecommendationState();
  const records = history.filter((record) => record.source === "Netesae");
  const route = useRecommendationRoute("Netesae", records);
  const pending = task.source === "Netesae" && task.runId === route.pendingId ? task : null;
  const selected = route.record;
  const retriedEmptyRecord = useRef(false);

  useEffect(() => hydrateRecommendationState(), []);

  function playAll(songs: SongInfo[]) {
    if (songs.length === 0) return;
    playerControl.set.songs(songs);
    playerControl.set.index(0);
    playerControl.set.play();
  }

  function startRandom() {
    route.openPending(startRandomRecommendation("Netesae", true));
  }

  function startFromSong(song: SongInfo) {
    route.openPending(startSampleRecommendation("Netesae", song.content.name, song.content.singer));
  }

  function refreshRecord() {
    if (!selected) return;
    if (selected.kind === "sample" && selected.song && selected.singer) {
      route.openPending(startSampleRecommendation("Netesae", selected.song, selected.singer));
    } else startRandom();
  }

  useEffect(() => {
    if (!connected || !route.isDetail || !selected || selected.songs.length || retriedEmptyRecord.current) return;
    retriedEmptyRecord.current = true;
    refreshRecord();
  }, [connected, route.isDetail, selected?.id]);

  if (!hydrated || audioSource === null) return <PlaylistSkeleton />;

  return <div className="flex flex-col gap-6 p-6">
    <Button variant="ghost" className="self-start gap-2 border border-white" onClick={route.back}><ArrowLeft className="h-4 w-4" />{route.isDetail || route.isPending ? t("recommend_history") : t("rand_recommend")}</Button>
    {!connected ? <div className="space-y-4"><h1 className="text-2xl font-bold">{t("rand_recommend_title")}</h1><p className="text-muted-foreground">{t("recommend_music_source_required")}</p></div> : route.isDetail && selected ? <>
      <p className="text-sm text-muted-foreground">{new Date(selected.completedAt).toLocaleString(i18n.language)} · {t("song_count", { count: selected.songs.length })}</p>
      {selected.songs.length > 0 && <>
        <MusicHeader title={selected.kind === "sample" ? t("song_recommend_sample", { song: selected.song, singer: selected.singer }) : t("rand_recommend_title")} subtitle={t("song_count", { count: selected.songs.length })} coverUrl={selected.coverUrl} handlePlayAllClick={() => playAll(selected.songs)} handleRefreshClick={refreshRecord} />
        <MusicList songs={selected.songs} showFeedback recommendationId={selected.id} onRecommend={startFromSong} />
      </>}
      {selected.songs.length === 0 && <GenerateRecommendationButton label={t("qr_retry")} onClick={refreshRecord} />}
    </> : route.isPending ? <>
      <h1 className="text-2xl font-bold">{pending?.kind === "sample" ? t("song_recommend_title") : t("rand_recommend_title")}</h1>
      {pending?.status === "error" ? <div role="alert" className="space-y-3 rounded-lg border border-destructive p-4"><p>{t("recommend_failed")}: {pending.error === "recommend_interrupted" ? t(pending.error) : pending.error}</p><GenerateRecommendationButton label={t("qr_retry")} onClick={() => pending.kind === "sample" && pending.song && pending.singer ? route.openPending(startSampleRecommendation("Netesae", pending.song, pending.singer)) : startRandom()} /></div> : <div role="status" aria-live="polite">{pending?.kind === "sample" && <p className="text-muted-foreground">{t("song_recommend_loading", { song: pending.song })}</p>}<PlaylistSkeleton /></div>}
    </> : <>
      <div className="flex items-center justify-between gap-3"><h1 className="text-2xl font-bold">{t("recommend_history")}</h1><GenerateRecommendationButton label={t("rand_recommend")} onClick={startRandom} /></div>
      {records.length > 0 ? <RecommendationHistoryList records={records} onSelect={route.openRecord} hideTitle /> : <p className="text-muted-foreground">{t("recommend_history_empty")}</p>}
    </>}
  </div>;
}

export default function NetEaseRecommendationPage() {
  return <Suspense fallback={<PlaylistSkeleton />}><NetEaseRecommendationContent /></Suspense>;
}
