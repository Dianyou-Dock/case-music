"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, History, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAudioSource } from "@/hooks/use-audio-source";
import { useAiSource } from "@/hooks/use-ai-source.tsx";
import { MusicList } from "@/components/music/music-list";
import { MusicHeader } from "@/components/music/music-header";
import { PlaylistSkeleton } from "@/components/playlist-skeleton";
import { Button } from "@/components/ui/button";
import { SongInfo } from "@/types/song";
import playerControl from "@/store/player-control";
import {
  hydrateRecommendationState,
  startRandomRecommendation,
  startSampleRecommendation,
  useRecommendationState,
} from "@/store/recommendation-task";

export default function RecommendationPage() {
  const { audioSource, currentSource } = useAudioSource();
  const { aiSource } = useAiSource();
  const hasAiSource = aiSource?.some((source) => source.used);
  const { t, i18n } = useTranslation();
  const { task, history, hydrated } = useRecommendationState();
  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const selectedRecord = history.find((record) => record.id === selectedHistoryId);
  const isSampleMode = task.kind === "sample";
  const hasHeader = !showHistory && audioSource !== null && aiSource !== null
    && Boolean(currentSource && hasAiSource)
    && task.status !== "running" && task.status !== "idle";

  useEffect(() => hydrateRecommendationState(), []);

  useEffect(() => {
    if (hydrated && currentSource && hasAiSource && task.status === "idle") {
      startRandomRecommendation(currentSource);
    }
  }, [hydrated, currentSource, hasAiSource, task.status]);

  const handlePlayAll = (songs: SongInfo[]) => {
    if (songs.length === 0) return;
    playerControl.set.songs(songs);
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

  const describeRecord = (record: typeof history[number]) => record.kind === "sample"
    ? t("song_recommend_sample", { song: record.song, singer: record.singer })
    : t("rand_recommend_title");

  const toggleHistory = () => {
    setShowHistory(!showHistory);
    setSelectedHistoryId(null);
  };

  if (!hydrated) {
    return <PlaylistSkeleton />;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {!hasHeader && (
        <Button variant="outline" className="self-start gap-2" onClick={toggleHistory}>
          <History className="h-4 w-4" />
          {showHistory ? t("recommend_current") : t("recommend_history")}
        </Button>
      )}

      {showHistory ? (
        selectedRecord ? (
          <div className="flex flex-col gap-5">
            <Button variant="ghost" className="self-start gap-2" onClick={() => setSelectedHistoryId(null)}>
              <ArrowLeft className="h-4 w-4" />{t("recommend_history")}
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{describeRecord(selectedRecord)}</h1>
              <p className="text-sm text-muted-foreground">
                {new Date(selectedRecord.completedAt).toLocaleString(i18n.language)}
                {" · "}{t("song_count", { count: selectedRecord.songs.length })}
              </p>
            </div>
            {selectedRecord.songs.length > 0 ? (
              <>
                <Button variant="outline" className="self-start gap-2" onClick={() => handlePlayAll(selectedRecord.songs)}>
                  <Play className="h-4 w-4" />{t("play_all")}
                </Button>
                <MusicList songs={selectedRecord.songs} />
              </>
            ) : <p className="text-muted-foreground">{t("recommend_empty")}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <h1 className="text-2xl font-bold">{t("recommend_history")}</h1>
            {history.length === 0 ? (
              <p className="text-muted-foreground">{t("recommend_history_empty")}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {history.map((record) => (
                  <Button
                    key={record.id}
                    variant="outline"
                    className="h-auto w-full min-w-0 justify-start px-4 py-3 text-left"
                    onClick={() => setSelectedHistoryId(record.id)}
                  >
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="truncate font-medium">{describeRecord(record)}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(record.completedAt).toLocaleString(i18n.language)}
                        {" · "}{t("song_count", { count: record.songs.length })}
                      </span>
                    </span>
                  </Button>
                ))}
              </div>
            )}
          </div>
        )
      ) : audioSource === null || aiSource === null ? (
        <PlaylistSkeleton />
      ) : !currentSource || !hasAiSource ? (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">
            {t(isSampleMode ? "song_recommend_title" : "rand_recommend_title")}
          </h1>
          <p role="alert" className="text-muted-foreground">
            {t(!currentSource ? "recommend_music_source_required" : "recommend_ai_source_required")}
          </p>
          <Button asChild><Link href="/settings">{t("settings")}</Link></Button>
        </div>
      ) : task.status === "running" || task.status === "idle" ? (
        <div role="status" aria-live="polite">
          {isSampleMode && (
            <p className="text-muted-foreground">{t("song_recommend_loading", { song: task.song })}</p>
          )}
          <PlaylistSkeleton />
        </div>
      ) : (
        <>
          <MusicHeader
            title={t(isSampleMode ? "song_recommend_title" : "rand_recommend_title")}
            subtitle={isSampleMode
              ? t("song_recommend_sample", { song: task.song, singer: task.singer })
              : t("song_count", { count: task.songs.length })}
            coverUrl={task.coverUrl}
            handlePlayAllClick={() => handlePlayAll(task.songs)}
            handleRefreshClick={handleRefresh}
            extraAction={
              <Button
                variant="outline"
                className="min-w-0 flex-1 gap-1 border-2 border-white bg-background px-1 text-xs text-white hover:bg-background hover:text-white sm:flex-none sm:gap-2 sm:px-4 sm:text-sm"
                title={t("recommend_history")}
                aria-label={t("recommend_history")}
                onClick={toggleHistory}
              >
                <History className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
                {t("recommend_history_button")}
              </Button>
            }
          />
          {isSampleMode && (
            <Button variant="outline" className="self-start" onClick={() => startRandomRecommendation(currentSource, true)}>
              {t("rand_recommend_title")}
            </Button>
          )}
          {task.error && (
            <div role="alert" className="space-y-3 rounded-lg border border-destructive p-4">
              <p>{t("recommend_failed")}: {task.error === "recommend_interrupted" ? t(task.error) : task.error}</p>
              <Button variant="outline" onClick={handleRefresh}>{t("qr_retry")}</Button>
            </div>
          )}
          {!task.error && task.songs.length === 0 && (
            <p className="text-muted-foreground">{t("recommend_empty")}</p>
          )}
          {task.songs.length > 0 && <MusicList songs={task.songs} />}
        </>
      )}
    </div>
  );
}
