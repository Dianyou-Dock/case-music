"use client";

import { useParams } from "next/navigation";
import { MusicList } from "@/components/music/music-list";
import { MusicHeader } from "@/components/music/music-header";
import { useMusicData } from "@/hooks/use-music-data";

export function PlaylistContent() {
  const { id } = useParams();
  const { playlist, isLoading } = useMusicData(id as string);

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <MusicHeader
        title={playlist?.name || "Playlist"}
        subtitle={`${playlist?.tracks.length || 0} songs`}
        coverUrl={playlist?.coverUrl}
      />
      <MusicList tracks={playlist?.tracks || []} />
    </div>
  );
}
