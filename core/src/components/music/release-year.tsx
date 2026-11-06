"use client";

import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { ApplicationResp } from "@/types/application";

const dates = new Map<number, Promise<string | null>>();

function loadDate(albumId: number) {
  if (!dates.has(albumId)) {
    dates.set(albumId, invoke<ApplicationResp<string | null>>("song_release_date", { albumId })
      .then((response) => response.data ?? null)
      .catch(() => null));
  }
  return dates.get(albumId)!;
}

export function ReleaseDate({ albumId, date }: { albumId: number; date?: string }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLSpanElement>(null);
  const [loadedDate, setLoadedDate] = useState<string | null>(date ?? null);

  useEffect(() => {
    setLoadedDate(date ?? null);
    if (date || !albumId || !ref.current) return;
    let active = true;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      observer.disconnect();
      void loadDate(albumId).then((result) => { if (active) setLoadedDate(result); });
    });
    observer.observe(ref.current);
    return () => { active = false; observer.disconnect(); };
  }, [albumId, date]);

  return <span ref={ref}>{loadedDate ?? t("song_year_unknown")}</span>;
}
