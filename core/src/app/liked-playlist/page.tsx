"use client";

import {useEffect, useState} from "react";
// import useLikedPlaylist from "@/hooks/use-liked-playlist";
import { MusicList } from "@/components/music/music-list";
import { MusicHeader } from "@/components/music/music-header";
import {ApplicationResp} from "@/types/application.ts";
import {Playlist} from "@/types/music.ts";
import {invoke} from "@tauri-apps/api/core";
import {defaultLimit} from "@/types/constants.ts";

export default function PlaylistPage() {
  // const { data, isLoading, mutate, error } = useLikedPlaylist({
  //   source: "Netesae",
  //   pageIndex: 0,
  // });

  // TODO: 这里应该要通过外部传进来, 因为不知道用户选择的是哪个音源的
  const source = "Netesae";
  const pageIndex = 0;

  async function likeList(): Promise<Playlist | undefined> {
    const result = await invoke<ApplicationResp<Playlist>>("like_list", {req : { source: source, offset: pageIndex, limit: defaultLimit }});
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
          playlist={playlist || undefined}
          source={source}
          total={playlist?.total || 0}
        />
        <MusicList songs={playlist?.songs || []} />
      </div>
    </>
  );
}
