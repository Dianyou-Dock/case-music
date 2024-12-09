import React from "react";
import useLikedPlaylist from "@/hooks/use-liked-playlist";
import { MusicList } from "@/components/music/music-list";
import { MusicHeader } from "@/components/music/music-header";
import {ApplicationResp} from "@/types/application.ts";
import {Playlist} from "@/types/music.ts";

export default function PlaylistPage() {
  const { data, isLoading, mutate, error } = useLikedPlaylist({
    source: "Netesae",
    pageIndex: 0,
  });

  console.log("isLoading:", isLoading)
  console.log("mutate: ", mutate)

  const result = data as ApplicationResp<Playlist>;
  const playlist = result.data as Playlist;

  console.log('error: ', error);

  console.log('data: ', result);


  return (
    <>
      <div className="flex flex-col gap-6 p-6">
        <MusicHeader
          title={playlist?.name || "Playlist"}
          subtitle={`${playlist?.songs.length || 0} songs`}
          coverUrl={playlist?.cover_img_url}
        />
        <MusicList songs={playlist?.songs || []} />
      </div>
    </>
  );
}
