"use client";

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ApplicationResp } from "@/types/application";

export function useSpotifyLikes(ids: string[], knownLiked = false) {
  const key = [...new Set(ids)].join(",");
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const effectiveLiked = new Set(ids.filter(id => overrides[id] ?? (knownLiked || liked.has(id))));

  useEffect(() => {
    const onChanged = (event: Event) => {
      const { id, liked: next } = (event as CustomEvent<{ id: string; liked: boolean }>).detail;
      setOverrides(previous => ({ ...previous, [id]: next }));
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
    if (pending.has(id)) return null;
    const next = !effectiveLiked.has(id);
    setError("");
    setPending(previous => new Set(previous).add(id));
    setOverrides(previous => ({ ...previous, [id]: next }));
    try {
      const response = await invoke<ApplicationResp<void>>("spotify_set_liked", { id, liked: next });
      if (response.code !== 0) throw new Error(response.msg || "Spotify library update failed");
      window.dispatchEvent(new CustomEvent("case-music:spotify-liked", { detail: { id, liked: next } }));
      return next;
    } catch (cause) {
      setOverrides(previous => ({ ...previous, [id]: !next }));
      setError(String(cause));
      return null;
    } finally {
      setPending(previous => { const updated = new Set(previous); updated.delete(id); return updated; });
    }
  }

  return { liked: effectiveLiked, toggle, pending, error };
}
