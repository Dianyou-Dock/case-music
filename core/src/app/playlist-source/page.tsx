"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAudioSource } from "@/hooks/use-audio-source";
import { useAccountPlaylists } from "@/hooks/use-account-playlists";
import { musicSourceName } from "@/lib/audio-sources";
import { MusicSource } from "@/types/constants";
import { Button } from "@/components/ui/button";
import useSWR from "swr";
import { invoke } from "@tauri-apps/api/core";
import { ApplicationResp } from "@/types/application";
import { qqUserPlaylists } from "@/lib/qq-music";

type SpotifyPlaylist = { id: string; name: string; images?: { url: string }[]; owner?: { display_name?: string }; external_urls?: { spotify?: string } };

function SpotifyPlaylists() {
  const { t } = useTranslation();
  const { data, error, isLoading, mutate } = useSWR("spotify-playlists", async () => {
    const response = await invoke<ApplicationResp<SpotifyPlaylist[]>>("spotify_playlists");
    if (response.code !== 0 || !response.data) throw new Error(response.msg || "Could not load Spotify playlists");
    return response.data;
  }, { revalidateOnFocus: false });
  return <>
    {isLoading && <p role="status" className="text-muted-foreground">{t("playlist_loading")}</p>}
    {error && <div role="alert" className="space-y-3"><p>{String(error)}</p><Button variant="outline" onClick={() => void mutate()}>{t("qr_retry")}</Button></div>}
    {data?.length === 0 && <p className="text-muted-foreground">{t("playlist_empty")}</p>}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {data?.map((playlist) => <Link key={playlist.id} href={`/spotify-playlist?id=${encodeURIComponent(playlist.id)}&name=${encodeURIComponent(playlist.name)}`} className="flex min-w-0 items-center gap-4 rounded-lg border bg-card p-3 transition-colors hover:bg-accent">
        {playlist.images?.[0]?.url && <img src={playlist.images[0].url} alt="" className="h-16 w-16 shrink-0 object-contain" />}
        <span className="min-w-0"><span className="block truncate font-medium">{playlist.name}</span><span className="block truncate text-sm text-muted-foreground">{playlist.owner?.display_name ?? "Spotify"}</span></span>
      </Link>)}
    </div>
  </>;
}

function QqPlaylists() {
  const { t } = useTranslation();
  const { data, error, isLoading, mutate } = useSWR("qq-account-playlists", qqUserPlaylists, { revalidateOnFocus: false });
  return <>
    {isLoading && <p role="status" className="text-muted-foreground">{t("playlist_loading")}</p>}
    {error && <div role="alert" className="space-y-3"><p>{String(error)}</p><Button variant="outline" onClick={() => void mutate()}>{t("qr_retry")}</Button></div>}
    {data?.length === 0 && <p className="text-muted-foreground">{t("playlist_empty")}</p>}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {data?.map((playlist) => <Link key={playlist.id} href={`/playlist?source=QQ&id=${encodeURIComponent(playlist.id)}`} className="flex min-w-0 items-center gap-4 rounded-lg border bg-card p-3 transition-colors hover:bg-accent">
        {playlist.pic_url && <img src={playlist.pic_url} alt="" className="h-16 w-16 shrink-0 rounded-md object-cover" />}
        <span className="truncate font-medium">{playlist.name}</span>
      </Link>)}
    </div>
  </>;
}

function SourcePlaylists() {
  const { t, i18n } = useTranslation();
  const source = useSearchParams().get("source") as MusicSource | null;
  const { audioSource } = useAudioSource();
  const connected = audioSource?.some((item) => item.id === source && item.connected);
  const { data, error, isLoading, mutate } = useAccountPlaylists(connected && source !== "Spotify" && source !== "QQ" ? source! : undefined);
  return <div className="space-y-6 p-6">
    <Button asChild variant="ghost" className="gap-2"><Link href="/playlists"><ArrowLeft className="h-4 w-4" />{t("playlist_nav")}</Link></Button>
    <h1 className="text-3xl font-bold">{source ? t("source_playlists", { source: musicSourceName(source, i18n.language) }) : t("playlist_nav")}</h1>
    {audioSource && !connected && <p className="text-muted-foreground">{t("playlist_source_required")}</p>}
    {connected && source === "Spotify" ? <SpotifyPlaylists /> : connected && source === "QQ" ? <QqPlaylists /> : <>
    {isLoading && <p role="status" className="text-muted-foreground">{t("playlist_loading")}</p>}
    {error && <div role="alert" className="space-y-3"><p>{t("playlist_load_failed")}: {String(error)}</p><Button variant="outline" onClick={() => void mutate()}>{t("qr_retry")}</Button></div>}
    {data?.length === 0 && <p className="text-muted-foreground">{t("playlist_empty")}</p>}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {data?.map((playlist) => <Link key={playlist.content.id} href={`/playlist?source=${encodeURIComponent(source!)}&id=${playlist.content.id}`} className="flex min-w-0 items-center gap-4 rounded-lg border bg-card p-3 transition-colors hover:bg-accent">
        <img src={playlist.content.cover_img_url} alt="" className="h-16 w-16 shrink-0 rounded-md object-cover" />
        <span className="min-w-0"><span className="block truncate font-medium">{playlist.content.name}</span><span className="block truncate text-sm text-muted-foreground">{playlist.content.author}</span></span>
      </Link>)}
    </div>
    </>}
  </div>;
}

export default function PlaylistSourcePage() {
  return <Suspense fallback={null}><SourcePlaylists /></Suspense>;
}
