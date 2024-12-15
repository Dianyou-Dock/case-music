"use client";

import {useEffect, useState} from "react";
// import useLikedPlaylist from "@/hooks/use-liked-playlist";
// import { MusicList } from "@/components/music/music-list";
// import { MusicHeader } from "@/components/music/music-header";
import {ApplicationResp} from "@/types/application.ts";
import {Playlist} from "@/types/music.ts";
import {invoke} from "@tauri-apps/api/core";
import {PlaylistContent} from "@/components/playlist/playlist-connect.tsx";


// TODO: 这个页面会连续请求两次,现在只需要请求一次即可
export default function PlaylistPage() {
  const [playlist, setPlaylist] = useState<Playlist | undefined>(undefined);

  // TODO: 这里应该要通过外部传进来, 因为不知道用户选择的是哪个音源的
  const source = "Netesae";

  async function randRecommendList(): Promise<Playlist | undefined> {
    const result = await invoke<ApplicationResp<Playlist>>("rand_recommends", {source: source});
    const playlist = result.data as Playlist;
    return playlist;
  }

  useEffect(() => {

    randRecommendList().then((res)=>{
      console.log('randRecommendList res: ', res);

      if (res) {
        setPlaylist(res)
      }

    })


  }, []);



  return (
    <>
      <PlaylistContent playlist={playlist} source={source}></PlaylistContent>
    </>
  );
}
