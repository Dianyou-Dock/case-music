"use client";

import { Suspense, useEffect, useLayoutEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
import { musicSourceName } from "@/lib/audio-sources";
import { SpotifyTracks } from "@/components/spotify/spotify-tracks";
import { SongInfo } from "@/types/song";
import playerControl from "@/store/player-control";
import { startSampleRecommendation } from "@/store/recommendation-task";
import { qqUserPlaylist } from "@/lib/qq-music";
import { QqMusicList } from "@/components/music/qq-music-list";
import { useQqPlayback } from "@/hooks/use-qq-playback";
import useSWR from "swr";

function QqLikedPlaylist() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { audioSource } = useAudioSource();
  const connected = audioSource?.some((source) => source.id === "QQ" && source.connected);
  const { data, error, isLoading, mutate } = useSWR(connected ? "qq-liked-songs" : null, () => qqUserPlaylist("qq-liked:201"), { revalidateOnFocus: false });
  const { play } = useQqPlayback();
  useEffect(() => {
    const onChanged = (event: Event) => {
      if (!(event as CustomEvent<{ liked: boolean }>).detail.liked) void mutate();
    };
    window.addEventListener("case-music:qq-liked", onChanged);
    return () => window.removeEventListener("case-music:qq-liked", onChanged);
  }, [mutate]);
  const recommend = (song: import("@/hooks/use-qq-playback").QqSong) => {
    const runId = startSampleRecommendation("QQ", song.name, song.artists[0]?.name ?? "", String(song.qq_id ?? ""));
    if (runId) router.push(`/rand-recommend/qq?pending=${encodeURIComponent(runId)}`);
  };
  return <div className="flex flex-col gap-6 p-6">
    <Button asChild variant="ghost" className="self-start gap-2 border border-white"><Link href="/liked-sources"><ArrowLeft className="h-4 w-4" />{t("liked_playlist")}</Link></Button>
    {!connected && audioSource && <p className="text-muted-foreground">{t("playlist_source_required")}</p>}
    {isLoading && <PlaylistSkeleton />}
    {error && <div role="alert" className="space-y-3"><p>{String(error)}</p><Button variant="outline" onClick={() => void mutate()}>{t("qr_retry")}</Button></div>}
    {data && <><MusicHeader title={`${t("liked_playlist")} · ${musicSourceName("QQ", i18n.language)}`} subtitle={t("song_count", { count: data.songs.length })} coverUrl={data.pic_url || data.songs[0]?.pic_url} handlePlayAllClick={() => void play(data.songs, 0)} handleRefreshClick={() => void mutate()} /><QqMusicList songs={data.songs} knownLiked onRecommend={recommend} /></>}
  </div>;
}

function LikedPlaylistDetail() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const selectedSource = useSearchParams().get("source");
  const { audioSource } = useAudioSource();
  const currentSource = audioSource?.find((source) => source.id === selectedSource && source.connected)?.id as import("@/types/constants").MusicSource | undefined;
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
      const runId = startSampleRecommendation(currentSource, song.content.name, song.content.singer);
      if (runId) router.push(`/rand-recommend/netease?pending=${encodeURIComponent(runId)}`);
    }
  };

  return (
    <div ref={pageRef} className="flex flex-col gap-6 p-6">
      <Button asChild variant="ghost" className="self-start gap-2 border border-white"><Link href="/liked-sources"><ArrowLeft className="h-4 w-4" />{t("liked_playlist")}</Link></Button>
      {audioSource && !currentSource && <p className="text-muted-foreground">{t("playlist_source_required")}</p>}
      {currentSource && (!loaded && !error ? <PlaylistSkeleton /> : (
        <>
          <MusicHeader
            title={currentSource ? `${t("liked_playlist")} · ${musicSourceName(currentSource, i18n.language)}` : t("liked_playlist")}
            subtitle={t("song_count", { count: total })}
            coverUrl={coverUrl}
            handlePlayAllClick={handlePlayAll}
            handleRefreshClick={handleRefresh}
          />
          <MusicList songs={songs} onRecommend={handleRecommend} />
        </>
      ))}
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

export default function PlaylistPage() {
  return <Suspense fallback={null}><SourceDetail /></Suspense>;
}

function SourceDetail() {
  const source = useSearchParams().get("source");
  const { t, i18n } = useTranslation();
  if (source === "Spotify") return <SpotifyTracks kind="liked" title={`${t("liked_playlist")} · ${musicSourceName("Spotify", i18n.language)}`} />;
  if (source === "QQ") return <QqLikedPlaylist />;
  return <LikedPlaylistDetail />;
}
