"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WandSparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAudioSource } from "@/hooks/use-audio-source";
import { musicSourceName } from "@/lib/audio-sources";
import { lastRecommendationViewKey } from "@/hooks/use-recommendation-route";

export default function RecommendationSourcesPage() {
  const { t, i18n } = useTranslation();
  const { audioSource } = useAudioSource();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const connected = audioSource?.filter((source) => source.connected && (source.id === "Netesae" || source.id === "Spotify")) ?? [];
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("sources")) {
      localStorage.setItem(lastRecommendationViewKey, "/rand-recommend");
      setReady(true);
      return;
    }
    const last = localStorage.getItem(lastRecommendationViewKey);
    if (last?.startsWith("/rand-recommend/spotify") || last?.startsWith("/rand-recommend/netease")) {
      router.replace(last);
    } else setReady(true);
  }, [router]);
  if (!ready) return null;
  return <div className="space-y-6 p-6">
    <h1 className="text-3xl font-bold">{t("rand_recommend_title")}</h1>
    {audioSource && connected.length === 0 && <p className="text-muted-foreground">{t("playlist_source_required")}</p>}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {connected.map((source) => <Link key={source.id} href={`/rand-recommend/${source.id === "Spotify" ? "spotify" : "netease"}`} className="flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-accent">
        <WandSparkles className="h-8 w-8 shrink-0 text-primary" />
        <span className="font-medium">{musicSourceName(source.id, i18n.language)}</span>
      </Link>)}
    </div>
  </div>;
}
