"use client";

import { Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import useSWRInfinite from "swr/infinite";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { MusicHeader } from "@/components/music/music-header";
import { MusicList } from "@/components/music/music-list";
import { PlaylistSkeleton } from "@/components/playlist-skeleton";
import { Button } from "@/components/ui/button";
import { useAudioSource } from "@/hooks/use-audio-source";
import { useAccountPlaylists } from "@/hooks/use-account-playlists";
import { startSampleRecommendation } from "@/store/recommendation-task";
import playerControl from "@/store/player-control";
import { ApplicationResp } from "@/types/application";
import { Playlist, PlaylistRes } from "@/types/music";
import { MusicSource } from "@/types/constants";
import { musicSourceName } from "@/lib/audio-sources";
import { SongInfo } from "@/types/song";
import { qqUserPlaylist } from "@/lib/qq-music";
import { QqMusicList } from "@/components/music/qq-music-list";
import useSWR from "swr";
import { useQqPlayback } from "@/hooks/use-qq-playback";

function QqPlaylistDetail() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const { t } = useTranslation();
  const { audioSource } = useAudioSource();
  const connected = audioSource?.some((source) => source.id === "QQ" && source.connected);
  const { data, error, isLoading, mutate } = useSWR(connected && id ? ["qq-playlist", id] : null, () => qqUserPlaylist(id), { revalidateOnFocus: false });
  const { play } = useQqPlayback();
  const recommend = (song: import("@/hooks/use-qq-playback").QqSong) => {
    const runId = startSampleRecommendation("QQ", song.name, song.artists[0]?.name ?? "", String(song.qq_id ?? ""));
    if (runId) router.push(`/rand-recommend/qq?pending=${encodeURIComponent(runId)}`);
  };
  return <div className="flex flex-col gap-6 p-6">
    <Button asChild variant="ghost" className="self-start gap-2 border border-white"><Link href="/playlist-source?source=QQ"><ArrowLeft className="h-4 w-4" />{t("playlist_nav")}</Link></Button>
    {!connected && audioSource && <p className="text-muted-foreground">{t("playlist_source_required")}</p>}
    {isLoading && <PlaylistSkeleton />}
    {error && <div role="alert" className="space-y-3"><p>{String(error)}</p><Button variant="outline" onClick={() => void mutate()}>{t("qr_retry")}</Button></div>}
    {data && <><MusicHeader title={data.name} subtitle={t("song_count", { count: data.songs.length })} coverUrl={data.pic_url || data.songs[0]?.pic_url} handlePlayAllClick={() => void play(data.songs, 0)} handleRefreshClick={() => void mutate()} /><QqMusicList songs={data.songs} onRecommend={recommend} /></>}
  </div>;
}

const pageSize = 100;

function PlaylistDetail() {
  const searchParams = useSearchParams();
  const id = Number(searchParams.get("id"));
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { audioSource } = useAudioSource();
  const source = searchParams.get("source") as MusicSource | null;
  const currentSource = audioSource?.some((item) => item.id === source && item.connected) ? source! : undefined;
  const { data: accountPlaylists } = useAccountPlaylists(currentSource);
  const selected = accountPlaylists?.find((playlist) => playlist.content.id === id);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { data, error, isValidating, size, setSize, mutate } = useSWRInfinite<Playlist>(
    (page, previous) => {
      if (!currentSource || !Number.isSafeInteger(id) || id <= 0) return null;
      if (previous && previous.songs.length === 0) return null;
      return ["playlist-songs", currentSource, id, page];
    },
    async ([, source, listId, page]: [string, typeof currentSource, number, number]) => {
      const response = await invoke<PlaylistRes>("list_songs", {
        req: { source, list_id: listId, offset: page, limit: pageSize },
      });
      if (response.code !== 0 || !response.data) throw new Error(response.msg || "Could not load playlist");
      return response.data;
    },
    { revalidateOnFocus: false },
  );
  const songs: SongInfo[] = data?.flatMap((page) => page.songs.map((song, index) => ({ ...song, liked: page.likeds[index] ?? song.liked }))) ?? [];
  const total = data?.[0]?.total ?? 0;
  const hasMore = data !== undefined && songs.length < total;

  useEffect(() => {
    if (!hasMore || isValidating || data?.length !== size) return;
    const sentinel = sentinelRef.current;
    const scroller = sentinel?.closest("main");
    if (!sentinel || !scroller) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void setSize(size + 1);
    }, { root: scroller, rootMargin: "400px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isValidating, data?.length, size, setSize]);

  const playAll = () => {
    if (!songs.length) return;
    playerControl.set.state((draft) => {
      draft.songs = songs;
      draft.index = 0;
      draft.immediately = undefined;
      draft.isPlaying = true;
    });
  };

  const refresh = async () => {
    await invoke<ApplicationResp<void>>("refresh_playlist", { listId: id });
    await setSize(1);
    await mutate();
  };

  const recommend = (song: SongInfo) => {
    if (currentSource) {
      const runId = startSampleRecommendation(currentSource, song.content.name, song.content.singer);
      if (runId) router.push(`/rand-recommend/netease?pending=${encodeURIComponent(runId)}`);
    }
  };

  if (!Number.isSafeInteger(id) || id <= 0) return <p className="p-6 text-muted-foreground">{t("playlist_invalid")}</p>;

  return (
    <div className="flex flex-col gap-6 p-6">
      <Button asChild variant="ghost" className="self-start gap-2 border border-white"><Link href={`/playlist-source?source=${encodeURIComponent(source ?? "")}`}><ArrowLeft className="h-4 w-4" />{source ? t("source_playlists", { source: musicSourceName(source, i18n.language) }) : t("playlist_nav")}</Link></Button>
      {!currentSource && <p className="text-muted-foreground">{t("playlist_source_required")}</p>}
      {currentSource && !data && !error && <PlaylistSkeleton />}
      {data && <>
        <MusicHeader title={data[0]?.name || selected?.content.name || t("playlists")} subtitle={t("song_count", { count: total })} coverUrl={data[0]?.cover_img_url || selected?.content.cover_img_url} handlePlayAllClick={playAll} handleRefreshClick={() => void refresh()} />
        <MusicList songs={songs} onRecommend={recommend} />
      </>}
      {error && <div role="alert" className="space-y-3"><p>{t("playlist_load_failed")}: {String(error)}</p><Button variant="outline" onClick={() => void mutate()}>{t("qr_retry")}</Button></div>}
      {hasMore && <div ref={sentinelRef} className="h-1" aria-hidden="true" />}
      {isValidating && data && <p role="status" className="text-center text-muted-foreground">{t("playlist_loading_more")}</p>}
    </div>
  );
}

export default function PlaylistPage() {
  return <Suspense fallback={<PlaylistSkeleton />}><SourceDetail /></Suspense>;
}

function SourceDetail() {
  const source = useSearchParams().get("source");
  return source === "QQ" ? <QqPlaylistDetail /> : <PlaylistDetail />;
}
