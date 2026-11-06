"use client";

import { Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useQqLikes } from "@/hooks/use-qq-likes";
import { recordSourceRecommendationFeedback } from "@/lib/recommendation-feedback";

export function QqPlayerHeart({ id, name }: { id?: string; name?: string }) {
  const { t } = useTranslation();
  const likes = useQqLikes(id ? [id] : []);
  if (!id) return null;
  const liked = likes.liked.has(id);
  async function toggle() {
    if (!id) return;
    const next = await likes.toggle(id);
    if (next) recordSourceRecommendationFeedback("QQ", id, "liked");
  }
  return <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" disabled={likes.pending.has(id)} title={likes.error || undefined} aria-label={t(liked ? "unlike_song" : "like_song", { name: name ?? "QQ 音乐" })} onClick={() => void toggle()}><Heart className={`h-4 w-4 ${liked ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} /></Button>;
}
