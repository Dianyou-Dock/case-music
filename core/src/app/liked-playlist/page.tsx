"use client";

import useLikedPlaylist from "@/hooks/use-liked-playlist";
import { useAudioSource } from "@/hooks/use-audio-source";
import { MusicList } from "@/components/music/music-list";
import { MusicHeader } from "@/components/music/music-header";

export default function PlaylistPage() {
  const { currentSource } = useAudioSource();

  const { data } = useLikedPlaylist({
    source: currentSource,
    pageIndex: 0,
  });

  return (
    <>
      <div className="flex flex-col gap-6 p-6">
        <MusicHeader
          title={data?.name || "Playlist"}
          subtitle={`${data?.songs.length || 0} songs`}
          coverUrl={data?.cover_img_url}
          playlist={data || undefined}
          source={currentSource}
          total={data?.total || 0}
          likeds={data?.songs.map(() => true) || []}
        />
        <MusicList songs={data?.songs || []} />
      </div>
    </>
  );
}
