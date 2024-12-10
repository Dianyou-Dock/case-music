"use client";

import {useEffect, useState} from "react";
// import useLikedPlaylist from "@/hooks/use-liked-playlist";
import { MusicList } from "@/components/music/music-list";
import { MusicHeader } from "@/components/music/music-header";
import {ApplicationResp} from "@/types/application.ts";
import {Playlist} from "@/types/music.ts";
import {invoke} from "@tauri-apps/api/core";

export default function PlaylistPage() {
  // const { data, isLoading, mutate, error } = useLikedPlaylist({
  //   source: "Netesae",
  //   pageIndex: 0,
  // });

  async function likeList(): Promise<Playlist | undefined> {
    const source = "Netesae";
    const pageIndex = 0;
    const result = await invoke<ApplicationResp<Playlist>>("like_list", {req : { source: source, offset: pageIndex, limit: 20 }});
    const playlist = result.data as Playlist;
    return playlist;
  }

  const [playlist, setPlaylist] = useState<Playlist>();
  useEffect(() => {

    likeList().then((res)=>{
      console.log('res: ', res);
      setPlaylist(res)

    })

  }, []);



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
