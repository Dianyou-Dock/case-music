"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import useSWRInfinite from "swr/infinite";
import { invoke } from "@tauri-apps/api/core";
import { ArrowLeft, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ApplicationResp } from "@/types/application";
import { Button } from "@/components/ui/button";
import { MusicHeader } from "@/components/music/music-header";
import { PlaylistSkeleton } from "@/components/playlist-skeleton";
import { useSpotifyPlayback } from "@/hooks/use-spotify-playback";
import { SpotifyMusicList } from "@/components/spotify/spotify-music-list";
import { SpotifyTrack } from "@/types/spotify-track";
import { startSampleRecommendation } from "@/store/recommendation-task";

type SpotifyPage = { items: { track?: SpotifyTrack | null; item?: SpotifyTrack | null }[]; total: number };

export function SpotifyTracks({ kind, id, title }: { kind: "liked" | "playlist"; id?: string; title: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [playError, setPlayError] = useState("");
  const spotify = useSpotifyPlayback();
  const sentinel = useRef<HTMLDivElement>(null);
  const { data, error, isValidating, size, setSize, mutate } = useSWRInfinite<SpotifyPage>(
    (page, previous) => previous && page * 50 >= previous.total ? null : ["spotify-tracks", kind, id ?? "", page],
    async ([, listKind, listId, page]: [string, string, string, number]) => {
      const command = listKind === "liked" ? "spotify_saved_tracks" : "spotify_playlist_items";
      const response = await invoke<ApplicationResp<SpotifyPage>>(command, listKind === "liked" ? { offset: page * 50 } : { id: listId, offset: page * 50 });
      if (!response.data || response.code !== 0) throw new Error(response.msg || "Spotify tracks could not be loaded");
      return response.data;
    },
    { revalidateOnFocus: false },
  );
  const tracks = data?.flatMap((page) => page.items.map((entry) => entry.item ?? entry.track).filter((track): track is SpotifyTrack => Boolean(track?.id))) ?? [];
  const total = data?.[0]?.total ?? 0;
  const hasMore = data !== undefined && size * 50 < total;

  useEffect(() => {
    if (kind !== "liked") return;
    const onChanged = (event: Event) => {
      if (!(event as CustomEvent<{ liked: boolean }>).detail.liked) void mutate();
    };
    window.addEventListener("case-music:spotify-liked", onChanged);
    return () => window.removeEventListener("case-music:spotify-liked", onChanged);
  }, [kind, mutate]);

  useEffect(() => {
    if (!hasMore || isValidating || data?.length !== size) return;
    const element = sentinel.current;
    const scroller = element?.closest("main");
    if (!element || !scroller) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void setSize(size + 1);
    }, { root: scroller, rootMargin: "400px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, isValidating, data?.length, size, setSize]);

  async function playlistQueue(): Promise<SpotifyTrack[]> {
    if (kind !== "playlist" || !id) return tracks;
    const all = [...tracks];
    for (let offset = size * 50; offset < total; offset += 50) {
      const response = await invoke<ApplicationResp<SpotifyPage>>("spotify_playlist_items", { id, offset });
      if (response.code !== 0 || !response.data) throw new Error(response.msg || "Spotify playlist could not be loaded");
      all.push(...response.data.items.map((entry) => entry.item ?? entry.track).filter((item): item is SpotifyTrack => Boolean(item?.id)));
      if (response.data.items.length === 0) break;
    }
    return all;
  }

  async function playTrack(track: SpotifyTrack, index: number) {
    setPlayError("");
    try {
      if (kind === "playlist" && id) await spotify.play({ playlistId: id, offsetTrackId: track.id, queueTracks: await playlistQueue() });
      else await spotify.play({ trackIds: tracks.slice(index, index + 100).map((item) => item.id), queueTracks: tracks.slice(index, index + 100) });
    } catch (error) {
      setPlayError(String(error));
    }
  }

  async function playPlaylist() {
    if (!id) return;
    setPlayError("");
    try { await spotify.play({ playlistId: id, queueTracks: await playlistQueue() }); }
    catch (error) { setPlayError(String(error)); }
  }

  function refresh() {
    void mutate();
  }

  return <div className="flex flex-col gap-6 p-6">
    <Button asChild variant="ghost" className="self-start gap-2 border border-white"><Link href={kind === "liked" ? "/liked-sources" : "/playlist-source?source=Spotify"}><ArrowLeft className="h-4 w-4" />{kind === "liked" ? t("liked_playlist") : t("playlist_nav")}</Link></Button>
    {!data && !error ? <PlaylistSkeleton /> : kind === "liked" ?
      <MusicHeader title={title} subtitle={t("song_count", { count: total })} coverUrl={tracks[0]?.album?.images?.[0]?.url} handlePlayAllClick={() => { if (tracks.length) void playTrack(tracks[0], 0); }} handleRefreshClick={refresh} /> :
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-bold">{title}</h1><p className="text-muted-foreground">{t("song_count", { count: total })} · Spotify</p></div>
        <Button onClick={() => void playPlaylist()} className="gap-2"><Play className="h-4 w-4" />{t("play_all")}</Button>
      </div>}
    {!spotify.ready && spotify.error && <p role="alert" className="text-sm text-destructive">{spotify.error}</p>}
    {playError && <p role="alert" className="text-sm text-destructive">{playError}</p>}
    {error && <div role="alert" className="space-y-2"><p>{String(error)}</p><Button variant="outline" onClick={() => void mutate()}>{t("qr_retry")}</Button></div>}
    <SpotifyMusicList tracks={tracks} knownLiked={kind === "liked"} onPlay={(track, index) => void playTrack(track, index)} onRecommend={(track) => { const runId = startSampleRecommendation("Spotify", track.name, track.artists?.[0]?.name ?? "", track.id); if (runId) router.push(`/rand-recommend/spotify?pending=${encodeURIComponent(runId)}`); }} />
    {hasMore && <div ref={sentinel} className="h-1" aria-hidden="true" />}
    {isValidating && <p role="status" className="text-center text-muted-foreground">{t("playlist_loading_more")}</p>}
  </div>;
}
