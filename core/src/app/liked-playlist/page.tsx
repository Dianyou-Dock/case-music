"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import useLikedPlaylist, {
  getLikedScroll,
  loadMoreLiked,
  refreshLiked,
  saveLikedScroll,
} from "@/hooks/use-liked-playlist";
import { useAudioSource } from "@/hooks/use-audio-source";
import { MusicList } from "@/components/music/music-list";
import { MusicHeader } from "@/components/music/music-header";
import { PlaylistSkeleton } from "@/components/playlist-skeleton";
import { Button } from "@/components/ui/button";
import { SongInfo } from "@/types/song";
import playerControl from "@/store/player-control";
import { startSampleRecommendation } from "@/store/recommendation-task";

export default function PlaylistPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { currentSource } = useAudioSource();
  const { songs, total, coverUrl, loaded, loading, error, hasMore } = useLikedPlaylist(currentSource);
  const pageRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!currentSource || !loaded) return;
    const scroller = pageRef.current?.closest("main");
    if (!scroller) return;
    let restored = false;
    const frame = requestAnimationFrame(() => {
      scroller.scrollTop = getLikedScroll(currentSource);
      restored = true;
    });
    const handleScroll = () => {
      if (restored) saveLikedScroll(currentSource, scroller.scrollTop);
    };
    scroller.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      if (restored) saveLikedScroll(currentSource, scroller.scrollTop);
      scroller.removeEventListener("scroll", handleScroll);
    };
  }, [currentSource, loaded]);

  useEffect(() => {
    if (!currentSource || !loaded || loading || error || !hasMore) return;
    const sentinel = sentinelRef.current;
    const scroller = pageRef.current?.closest("main");
    if (!sentinel || !scroller) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMoreLiked(currentSource);
      },
      { root: scroller, rootMargin: "400px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [currentSource, loaded, loading, error, hasMore, songs.length]);

  const handlePlayAll = () => {
    if (songs.length === 0) return;
    playerControl.set.songs(songs);
    playerControl.set.index(0);
    playerControl.set.play();
  };

  const handleRefresh = () => {
    if (!currentSource) return;
    const scroller = pageRef.current?.closest("main");
    if (scroller) scroller.scrollTop = 0;
    void refreshLiked(currentSource);
  };

  const handleRecommend = (song: SongInfo) => {
    if (currentSource) {
      startSampleRecommendation(currentSource, song.content.name, song.content.singer);
    }
    router.push("/rand-recommend");
  };

  return (
    <div ref={pageRef} className="flex flex-col gap-6 p-6">
      {!loaded && !error ? <PlaylistSkeleton /> : (
        <>
          <MusicHeader
            title={t("liked_playlist")}
            subtitle={t("liked_loaded_count", { loaded: songs.length, total })}
            coverUrl={coverUrl}
            handlePlayAllClick={handlePlayAll}
            handleRefreshClick={handleRefresh}
          />
          <MusicList songs={songs} onRecommend={handleRecommend} />
        </>
      )}
      {error && (
        <div role="alert" className="space-y-3 rounded-lg border border-destructive p-4">
          <p>{t("liked_load_failed")}: {error}</p>
          <Button variant="outline" onClick={() => currentSource && void loadMoreLiked(currentSource)}>
            {t("qr_retry")}
          </Button>
        </div>
      )}
      {loaded && hasMore && <div ref={sentinelRef} className="h-1" aria-hidden="true" />}
      {loaded && loading && <p role="status" className="text-center text-muted-foreground">{t("liked_loading_more")}</p>}
    </div>
  );
}
