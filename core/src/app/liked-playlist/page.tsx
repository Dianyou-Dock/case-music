"use client";

import useLikedPlaylist from "@/hooks/use-liked-playlist";
import { useAudioSource } from "@/hooks/use-audio-source";
import { MusicList } from "@/components/music/music-list";
import { MusicHeader } from "@/components/music/music-header";
import { useEffect } from "react";
import playerControl from "@/store/player-control";
import { PlaylistSkeleton } from "@/components/playlist-skeleton";
import { SongInfo } from "@/types/song.ts";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { startSampleRecommendation } from "@/store/recommendation-task";

export default function PlaylistPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { currentSource } = useAudioSource();
  const { data, isLoading } = useLikedPlaylist({
    source: currentSource,
    pageIndex: 0,
  });

  useEffect(() => {}, [data]);

  const handlePlayAll = () => {
    playerControl.set.songs(data?.songs || []);
    playerControl.set.index(0);
    playerControl.set.play();
  };

  const handleRefresh = () => {};

  const handleRecommend = (song: SongInfo) => {
    if (currentSource) {
      startSampleRecommendation(currentSource, song.content.name, song.content.singer);
    }
    router.push("/rand-recommend");
  };

  if (isLoading) {
    return <PlaylistSkeleton />;
  }

  return (
    <>
      <div className="flex flex-col gap-6 p-6">
        <MusicHeader
          title={t("liked_playlist")}
          subtitle={t("song_count", { count: data?.songs?.length || 0 })}
          coverUrl={data?.cover_img_url}
          handlePlayAllClick={handlePlayAll}
          handleRefreshClick={handleRefresh}
        />
        <MusicList songs={data?.songs || []} onRecommend={handleRecommend} />
      </div>
    </>
  );
}
