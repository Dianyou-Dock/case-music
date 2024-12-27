"use client";

import useLikedPlaylist from "@/hooks/use-liked-playlist";
import { useAudioSource } from "@/hooks/use-audio-source";
import { MusicList } from "@/components/music/music-list";
import { MusicHeader } from "@/components/music/music-header";
import {useEffect, useState} from "react";
import playerControl from "@/store/player-control";
import { PlaylistSkeleton } from "@/components/playlist-skeleton";
import InfiniteScroll from "react-infinite-scroll-component";

export default function PlaylistPage() {
  const { currentSource } = useAudioSource();
  const [pageIndex, setPageIndex] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const { data, isLoading } = useLikedPlaylist({
    source: currentSource,
    pageIndex: pageIndex,
  });

  useEffect(() => {}, [data]);

  const handlePlayAll = () => {
    playerControl.set.songs(data?.songs || []);
    playerControl.set.playlistId(data?.id || -1);
    playerControl.set.index(0);
    playerControl.set.play();
  };

  const handleRefresh = () => {};

  const fetchMoreData = () => {
    if (data && data.songs) {
      if (data?.songs?.length > 0) {
        setPageIndex((prev) => prev + 1); // 增加页码，触发数据加载
      } else {
        setHasMore(false);
      }
    }
  };

  if (isLoading && pageIndex === 0) {
    return <PlaylistSkeleton />;
  }

  if (isLoading) {
    return <PlaylistSkeleton />;
  }

  return (
    <>
      <div className="flex flex-col gap-6 p-6 overflow-auto" id="scrollableDiv">
        <InfiniteScroll
          dataLength={data?.songs?.length || 0} // 当前数据长度
          next={fetchMoreData} // 加载更多函数
          hasMore={hasMore} // 根据总数判断是否还有更多数据
          loader={<h4>Loading...</h4>} // 加载时的占位符
          endMessage={<p>No more songs to load</p>} // 数据加载完后的提示
          scrollableTarget="scrollableDiv"
          // scrollThreshold={0.7}
        >
          <MusicHeader
            title={data?.name || "Playlist"}
            subtitle={`${data?.songs?.length || 0} songs`}
            coverUrl={data?.cover_img_url}
            handlePlayAllClick={handlePlayAll}
            handleRefreshClick={handleRefresh}
          />
          <MusicList songs={data?.songs || []} />
        </InfiniteScroll>
      </div>
    </>
  );
}
