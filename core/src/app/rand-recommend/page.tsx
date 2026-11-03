"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useAudioSource } from "@/hooks/use-audio-source";
import { useAiSource } from "@/hooks/use-ai-source.tsx";
import { MusicList } from "@/components/music/music-list";
import { MusicHeader } from "@/components/music/music-header";
import { PlaylistSkeleton } from "@/components/playlist-skeleton";
import { Button } from "@/components/ui/button";
import playerControl from "@/store/player-control";
import {
  startRandomRecommendation,
  startSampleRecommendation,
  useRecommendationTask,
} from "@/store/recommendation-task";

export default function RecommendationPage() {
  const { audioSource, currentSource } = useAudioSource();
  const { aiSource } = useAiSource();
  const hasAiSource = aiSource?.some((source) => source.used);
  const { t } = useTranslation();
  const task = useRecommendationTask();
  const isSampleMode = task.kind === "sample";

  useEffect(() => {
    if (currentSource && hasAiSource && task.status === "idle") {
      startRandomRecommendation(currentSource);
    }
  }, [currentSource, hasAiSource, task.status]);

  const handlePlayAll = () => {
    if (task.songs.length === 0) return;
    playerControl.set.songs(task.songs);
    playerControl.set.index(0);
    playerControl.set.play();
  };

  const handleRefresh = () => {
    if (!currentSource) return;
    if (isSampleMode && task.song && task.singer) {
      startSampleRecommendation(currentSource, task.song, task.singer);
    } else {
      startRandomRecommendation(currentSource, true);
    }
  };

  if (audioSource !== null && aiSource !== null && (!currentSource || !hasAiSource)) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-bold">
          {t(isSampleMode ? "song_recommend_title" : "rand_recommend_title")}
        </h1>
        <p role="alert" className="text-muted-foreground">
          {t(!currentSource ? "recommend_music_source_required" : "recommend_ai_source_required")}
        </p>
        <Button asChild><Link href="/settings">{t("settings")}</Link></Button>
      </div>
    );
  }

  if (audioSource === null || aiSource === null || task.status === "running" || task.status === "idle") {
    return (
      <div role="status" aria-live="polite">
        {isSampleMode && (
          <p className="px-6 pt-6 text-muted-foreground">
            {t("song_recommend_loading", { song: task.song })}
          </p>
        )}
        <PlaylistSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <MusicHeader
        title={t(isSampleMode ? "song_recommend_title" : "rand_recommend_title")}
        subtitle={isSampleMode
          ? t("song_recommend_sample", { song: task.song, singer: task.singer })
          : t("song_count", { count: task.songs.length })}
        coverUrl={task.coverUrl}
        handlePlayAllClick={handlePlayAll}
        handleRefreshClick={handleRefresh}
      />
      {isSampleMode && (
        <Button variant="outline" className="self-start" onClick={() => startRandomRecommendation(currentSource, true)}>
          {t("rand_recommend_title")}
        </Button>
      )}
      {task.error && (
        <div role="alert" className="space-y-3 rounded-lg border border-destructive p-4">
          <p>{t("recommend_failed")}: {task.error}</p>
          <Button variant="outline" onClick={handleRefresh}>{t("qr_retry")}</Button>
        </div>
      )}
      {!task.error && task.songs.length === 0 && (
        <p className="text-muted-foreground">{t("recommend_empty")}</p>
      )}
      {task.songs.length > 0 && <MusicList songs={task.songs} />}
    </div>
  );
}
