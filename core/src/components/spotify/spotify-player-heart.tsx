"use client";

import { Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useSpotifyLikes } from "@/hooks/use-spotify-likes";

export function SpotifyPlayerHeart({ id, name }: { id?: string; name?: string }) {
  const { t } = useTranslation();
  const likes = useSpotifyLikes(id ? [id] : []);
  if (!id) return null;
  const liked = likes.liked.has(id);
  return <span className="inline-flex shrink-0 flex-col items-center"><Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" disabled={likes.pending.has(id)} aria-label={t(liked ? "unlike_song" : "like_song", { name: name ?? "Spotify" })} onClick={() => void likes.toggle(id)}><Heart className={`h-4 w-4 ${liked ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} /></Button>{likes.error && <span role="alert" className="max-w-48 text-center text-xs text-destructive">{likes.error}</span>}</span>;
}
