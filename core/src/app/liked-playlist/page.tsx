"use client";

import useLikedPlaylist from "@/hooks/use-liked-playlist";
import { useAudioSource } from "@/hooks/use-audio-source";
import { MusicList } from "@/components/music/music-list";
import { MusicHeader } from "@/components/music/music-header";
import { useEffect } from "react";
import playerControl from "@/store/player-control";

export default function PlaylistPage() {
  const { currentSource } = useAudioSource();
  const { data } = useLikedPlaylist({
    source: currentSource,
    pageIndex: 0,
  });

  useEffect(() => {

  }, [data]);

  const handlePlayAll = () => {
    playerControl.set.songs(data?.songs || []);
    playerControl.set.index(0);
    playerControl.set.play();
  };

  const handleRefresh = () => {}

  return (
    <>
      <div className="flex flex-col gap-6 p-6">
        <MusicHeader
          title={data?.name || "Playlist"}
          subtitle={`${data?.songs?.length || 0} songs`}
          coverUrl={data?.cover_img_url}
          handlePlayAllClick={handlePlayAll}
          handleRefreshClick={handleRefresh}
        />
        <MusicList songs={data?.songs || []} />
      </div>
    </>
  );
}
