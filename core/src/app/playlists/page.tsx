"use client";

import Link from "next/link";
import { ListMusic } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAudioSource } from "@/hooks/use-audio-source";
import { musicSourceName } from "@/lib/audio-sources";

export default function PlaylistsPage() {
  const { t, i18n } = useTranslation();
  const { audioSource } = useAudioSource();
  const connected = audioSource?.filter((source) => source.connected) ?? [];

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">{t("playlist_nav")}</h1>
      {audioSource && connected.length === 0 && <p className="text-muted-foreground">{t("playlist_source_required")}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {connected.map((source) => (
          <Link key={source.id} href={source.id === "QQ" ? "/qq-music" : `/playlist-source?source=${encodeURIComponent(source.id)}`} className="flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-accent">
            <ListMusic className="h-8 w-8 shrink-0 text-primary" />
            <span className="font-medium">{t("source_playlists", { source: musicSourceName(source.id, i18n.language) })}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
