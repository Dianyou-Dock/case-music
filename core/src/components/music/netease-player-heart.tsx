"use client";

import { Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { ApplicationResp } from "@/types/application";
import playerControl from "@/store/player-control";
import { recordRecommendationFeedback } from "@/lib/recommendation-feedback";

export function NetEasePlayerHeart() {
  const { t } = useTranslation();
  const current = playerControl.useTracked.currentSong();
  const immediately = playerControl.useTracked.immediately();
  if (!current) return null;
  const liked = current.liked;
  async function toggle() {
    if (!current) return;
    const next = !current.liked;
    if (immediately) playerControl.set.likeImmediately(next);
    else playerControl.set.likeCurrent(next);
    try {
      const response = await invoke<ApplicationResp<boolean>>( "like_song", { req: { source: current.type, song_id: current.content.id, is_like: next } });
      if (response.code !== 0) throw new Error(response.msg || "Could not update liked song");
      if (next) recordRecommendationFeedback(current, "liked");
    } catch (cause) {
      if (immediately) playerControl.set.likeImmediately(!next);
      else playerControl.set.likeCurrent(!next);
      console.error(cause);
    }
  }
  return <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={t(liked ? "unlike_song" : "like_song", { name: current.content.name })} onClick={() => void toggle()}><Heart className={`h-4 w-4 ${liked ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} /></Button>;
}
