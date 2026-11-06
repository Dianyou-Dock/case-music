"use client";

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ApplicationResp } from "@/types/application";

export function useSpotifyLikes(ids: string[], knownLiked = false) {
  const key = [...new Set(ids)].join(",");
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [unliked, setUnliked] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const effectiveLiked = knownLiked ? new Set(ids.filter((id) => !unliked.has(id))) : liked;

  useEffect(() => {
    const onChanged = (event: Event) => {
      const { id, liked: next } = (event as CustomEvent<{ id: string; liked: boolean }>).detail;
      setLiked((previous) => {
        const updated = new Set(previous);
        if (next) updated.add(id); else updated.delete(id);
        return updated;
      });
      setUnliked((previous) => {
        const updated = new Set(previous);
        if (next) updated.delete(id); else updated.add(id);
        return updated;
      });
    };
    window.addEventListener("case-music:spotify-liked", onChanged);
    return () => window.removeEventListener("case-music:spotify-liked", onChanged);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const requested = key ? key.split(",") : [];
    if (requested.length === 0) { setLiked(new Set()); return; }
    if (knownLiked) {
      setError("");
      return;
    }
    void (async () => {
      try {
        const found = new Set<string>();
        for (let offset = 0; offset < requested.length; offset += 40) {
          const batch = requested.slice(offset, offset + 40);
          const response = await invoke<ApplicationResp<boolean[]>>("spotify_library_contains", { ids: batch });
          if (response.code !== 0 || !response.data) throw new Error(response.msg || "Spotify library could not be checked");
          response.data.forEach((value, index) => { if (value) found.add(batch[index]); });
        }
        if (!cancelled) { setLiked(found); setError(""); }
      } catch (cause) { if (!cancelled) setError(String(cause)); }
    })();
    return () => { cancelled = true; };
  }, [key, knownLiked]);

  async function toggle(id: string) {
    const next = !effectiveLiked.has(id);
    setError("");
    try {
      const response = await invoke<ApplicationResp<void>>("spotify_set_liked", { id, liked: next });
      if (response.code !== 0) throw new Error(response.msg || "Spotify library update failed");
      setLiked((previous) => {
        const updated = new Set(previous);
        if (next) updated.add(id); else updated.delete(id);
        return updated;
      });
      setUnliked((previous) => {
        const updated = new Set(previous);
        if (next) updated.delete(id); else updated.add(id);
        return updated;
      });
      window.dispatchEvent(new CustomEvent("case-music:spotify-liked", { detail: { id, liked: next } }));
      return next;
    } catch (cause) { setError(String(cause)); return null; }
  }

  return { liked: effectiveLiked, toggle, error };
}
