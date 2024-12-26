"use client";

import { useAudioSource } from "@/hooks/use-audio-source";
import { MusicList } from "@/components/music/music-list";
import { MusicHeader } from "@/components/music/music-header";
import playerControl from "@/store/player-control";
import useRandRecommend from "@/hooks/use-rand-recommend.ts";
import { invoke } from "@tauri-apps/api/core";
import { ApplicationResp } from "@/types/application.ts";
import { useMemo, useState } from "react";
import { PlaylistSkeleton } from "@/components/playlist-skeleton";
import {useTranslation} from "react-i18next";

export default function RandomRecommendPage() {
  const [loading, setLoading] = useState(false);
  const { currentSource } = useAudioSource();
  const { data, isLoading, mutate } = useRandRecommend({
    source: currentSource,
  });
  const { t } = useTranslation();

  const handlePlayAll = () => {
    playerControl.set.songs(data?.songs || []);
    playerControl.set.index(0);
    playerControl.set.play();
  };

  const handleRefresh = () => {
    setLoading(true);
    invoke<ApplicationResp<any>>("refresh_rand_cache", {
      source: currentSource,
    })
      .then((res) => {
        mutate();
        console.log("refresh_rand_cache res:", res);
      })
      .catch((err) => console.log("refresh err: ", err))
      .finally(() => setLoading(false));
  };

  const isPageLoading = useMemo(() => {
    return loading || isLoading;
  }, [loading, isLoading]);

  return (
    <>
      <div className="flex flex-col gap-6 p-6">
        {isPageLoading ? (
          <PlaylistSkeleton />
        ) : (
          <>
            <MusicHeader
              title={t("rand_recommend_title")}
              subtitle={`${data?.songs?.length || 0} songs`}
              coverUrl={data?.cover_img_url}
              handlePlayAllClick={handlePlayAll}
              handleRefreshClick={handleRefresh}
            />
            <MusicList songs={data?.songs || []} />
          </>
        )}
      </div>
    </>
  );
}
