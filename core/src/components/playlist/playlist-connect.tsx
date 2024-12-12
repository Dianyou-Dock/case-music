"use client";

import { useParams } from "next/navigation";
import { MusicList } from "@/components/music/music-list";
import { MusicHeader } from "@/components/music/music-header";
import { useMusicData } from "@/hooks/use-music-data";

export function PlaylistContent() {
  const { id } = useParams();
  const { playlist, isLoading } = useMusicData(id as unknown as number);
  const source = "Netesae";

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <MusicHeader
        title={playlist?.name || "Playlist"}
        subtitle={`${playlist?.songs.length || 0} songs`}
        coverUrl={playlist?.cover_img_url}
        playlist={playlist || undefined}
        source={source}
        total={0}
        likeds={[]}
      />
      <MusicList songs={playlist?.songs || []} likeds={[]} />
    </div>
  );
}
