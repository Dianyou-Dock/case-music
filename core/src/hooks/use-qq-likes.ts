"use client";

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ApplicationResp } from "@/types/application";

const statusCache = new Map<string, boolean>();
const statusRevision = new Map<string, number>();

export function resetQqLikesCache() {
  statusCache.clear();
  statusRevision.clear();
  window.dispatchEvent(new Event("case-music:qq-account-changed"));
}

export function useQqLikes(ids: string[], knownLiked = false) {
  const key = [...new Set(ids)].join(",");
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [unliked, setUnliked] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [accountRevision, setAccountRevision] = useState(0);
  const [error, setError] = useState("");
  const effectiveLiked = knownLiked
    ? new Set(ids.filter((id) => !unliked.has(id)))
    : new Set(ids.filter((id) => statusCache.get(id) ?? liked.has(id)));

  useEffect(() => {
    const onChanged = (event: Event) => {
      const { id, liked: next } = (event as CustomEvent<{ id: string; liked: boolean }>).detail;
      statusCache.set(id, next);
      statusRevision.set(id, (statusRevision.get(id) ?? 0) + 1);
      setLiked((previous) => { const updated = new Set(previous); if (next) updated.add(id); else updated.delete(id); return updated; });
      setUnliked((previous) => { const updated = new Set(previous); if (next) updated.delete(id); else updated.add(id); return updated; });
    };
    const onAccountChanged = () => { setLiked(new Set()); setUnliked(new Set()); setAccountRevision((value) => value + 1); };
    window.addEventListener("case-music:qq-liked", onChanged);
    window.addEventListener("case-music:qq-account-changed", onAccountChanged);
    return () => {
      window.removeEventListener("case-music:qq-liked", onChanged);
      window.removeEventListener("case-music:qq-account-changed", onAccountChanged);
    };
  }, []);

  useEffect(() => {
    if (knownLiked) { setError(""); return; }
    const requested = key ? key.split(",") : [];
    if (!requested.length) { setLiked(new Set()); return; }
    let cancelled = false;
    const revision = new Map(requested.map((id) => [id, statusRevision.get(id) ?? 0]));
    void (async () => {
      try {
        const found = new Set<string>();
        for (let offset = 0; offset < requested.length; offset += 100) {
          const batch = requested.slice(offset, offset + 100);
          const response = await invoke<ApplicationResp<boolean[]>>("qq_liked_status", { ids: batch });
          if (cancelled) return;
          if (response.code !== 0 || !response.data || response.data.length !== batch.length) throw new Error(response.msg || "QQ 音乐收藏状态查询失败");
          response.data.forEach((value, index) => {
            const id = batch[index];
            if (revision.get(id) === (statusRevision.get(id) ?? 0)) statusCache.set(id, value);
            if (statusCache.get(id)) found.add(id);
          });
        }
        if (!cancelled) { setLiked(found); setError(""); }
      } catch (cause) { if (!cancelled) setError(String(cause)); }
    })();
    return () => { cancelled = true; };
  }, [key, knownLiked, accountRevision]);

  async function toggle(id: string) {
    if (pending.has(id)) return null;
    const next = !effectiveLiked.has(id);
    setError("");
    setPending((previous) => new Set(previous).add(id));
    try {
      const response = await invoke<ApplicationResp<void>>("qq_set_liked", { id, liked: next });
      if (response.code !== 0) throw new Error(response.msg || "QQ 音乐收藏修改失败");
      window.dispatchEvent(new CustomEvent("case-music:qq-liked", { detail: { id, liked: next } }));
      return next;
    } catch (cause) { setError(String(cause)); return null; }
    finally { setPending((previous) => { const updated = new Set(previous); updated.delete(id); return updated; }); }
  }

  return { liked: effectiveLiked, pending, toggle, error };
}
