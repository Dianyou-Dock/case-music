"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { useAudioSource } from "@/hooks/use-audio-source";
import { useAiSource } from "@/hooks/use-ai-source.tsx";
import useRandRecommend from "@/hooks/use-rand-recommend.ts";
import useSongRecommend from "@/hooks/use-song-recommend.ts";
import { MusicList } from "@/components/music/music-list";
import { MusicHeader } from "@/components/music/music-header";
import { PlaylistSkeleton } from "@/components/playlist-skeleton";
import { Button } from "@/components/ui/button";
import { ApplicationResp } from "@/types/application.ts";
import playerControl from "@/store/player-control";

function RecommendationContent() {
  const params = useSearchParams();
  const song = params.get("song");
  const singer = params.get("singer");
  const request = params.get("request");
  const isSampleMode = Boolean(song && singer);
  const { audioSource, currentSource } = useAudioSource();
  const { aiSource } = useAiSource();
  const hasAiSource = aiSource?.some((source) => source.used);
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const source = currentSource && hasAiSource ? currentSource : undefined;

  useEffect(() => setRefreshError(""), [song, singer, request]);

  const random = useRandRecommend({ source: isSampleMode ? undefined : source });
  const sample = useSongRecommend({
    source: isSampleMode ? source : undefined,
    song,
    singer,
    request,
  });

  const songs = isSampleMode ? sample.data?.song_infos ?? [] : random.data?.songs ?? [];
  const error = refreshError || (isSampleMode ? sample.error : random.error);
  const isLoading =
    refreshing ||
    audioSource === null ||
    aiSource === null ||
    (isSampleMode ? sample.isLoading : random.isLoading);

  const handlePlayAll = () => {
    if (songs.length === 0) return;
    playerControl.set.songs(songs);
    playerControl.set.index(0);
    playerControl.set.play();
  };

  const handleRefresh = async () => {
    setRefreshError("");
    setRefreshing(true);
    try {
      if (isSampleMode) {
        await sample.mutate();
      } else if (source) {
        const response = await invoke<ApplicationResp<void>>("refresh_rand_cache", { source });
        if (response.code !== 0) throw new Error(response.msg);
        await random.mutate();
      }
    } catch (cause) {
      setRefreshError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div role="status" aria-live="polite">
        {isSampleMode && (
          <p className="px-6 pt-6 text-muted-foreground">
            {t("song_recommend_loading", { song })}
          </p>
        )}
        <PlaylistSkeleton />
      </div>
    );
  }

  if (!currentSource || !hasAiSource) {
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

  return (
    <div className="flex flex-col gap-6 p-6">
      <MusicHeader
        title={isSampleMode ? t("song_recommend_title") : t("rand_recommend_title")}
        subtitle={isSampleMode
          ? t("song_recommend_sample", { song, singer })
          : t("song_count", { count: songs.length })}
        coverUrl={isSampleMode ? undefined : random.data?.cover_img_url}
        handlePlayAllClick={handlePlayAll}
        handleRefreshClick={handleRefresh}
      />
      {error && (
        <div role="alert" className="space-y-3 rounded-lg border border-destructive p-4">
          <p>{t("recommend_failed")}: {String(error)}</p>
          <Button variant="outline" onClick={handleRefresh}>{t("qr_retry")}</Button>
        </div>
      )}
      {!error && songs.length === 0 && (
        <p className="text-muted-foreground">{t("recommend_empty")}</p>
      )}
      {songs.length > 0 && <MusicList songs={songs} />}
    </div>
  );
}

export default function RecommendationPage() {
  return (
    <Suspense fallback={<PlaylistSkeleton />}>
      <RecommendationContent />
    </Suspense>
  );
}
