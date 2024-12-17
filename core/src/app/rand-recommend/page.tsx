"use client";

import { useAudioSource } from "@/hooks/use-audio-source";
import { MusicList } from "@/components/music/music-list";
import { MusicHeader } from "@/components/music/music-header";
import { useEffect } from "react";
import playerControl from "@/store/player-control";
import useRandRecommend from "@/hooks/use-rand-recommend.ts";

export default function PlaylistPage() {
  const { currentSource } = useAudioSource();
  const { data } = useRandRecommend({
    source: currentSource,
  });

  useEffect(() => {
    playerControl.set.songs(data?.songs || []);
  }, [data]);

  const handlePlayAll = () => {
    playerControl.set.index(0);
    playerControl.set.play();
  };

  return (
    <>
      <div className="flex flex-col gap-6 p-6">
        <MusicHeader
          title={data?.name || "Playlist"}
          subtitle={`${data?.songs?.length || 0} songs`}
          coverUrl={data?.cover_img_url}
          handlePlayAllClick={handlePlayAll}
        />
        <MusicList songs={data?.songs || []} />
      </div>
    </>
  );
}
