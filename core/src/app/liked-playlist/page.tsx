import React from "react";
import useLikedPlaylist from "@/hooks/use-liked-playlist";
import { MusicList } from "@/components/music/music-list";
import { MusicHeader } from "@/components/music/music-header";

export default function PlaylistPage() {
  const { data, isLoading, mutate, error } = useLikedPlaylist({
    source: "Netesae",
    pageIndex: 0,
  });

  console.log('error: ', error);

  console.log('data: ', data);


  return (
    <>
      <div className="flex flex-col gap-6 p-6">
        {/* <MusicHeader
          title={playlist?.name || "Playlist"}
          subtitle={`${playlist?.tracks.length || 0} songs`}
          coverUrl={playlist?.coverUrl}
        />
        <MusicList tracks={playlist?.tracks || []} /> */}
      </div>
    </>
  );
}
