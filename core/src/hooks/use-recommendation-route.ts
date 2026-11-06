"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MusicSource } from "@/types/constants";
import { RecommendationRecord } from "@/store/recommendation-task";

export const lastRecommendationViewKey = "case-music:last-recommendation-view";

export function useRecommendationRoute(source: MusicSource, records: RecommendationRecord[]) {
  const router = useRouter();
  const params = useSearchParams();
  const base = `/rand-recommend/${source === "Spotify" ? "spotify" : source === "QQ" ? "qq" : "netease"}`;
  const recordId = params.get("record");
  const pendingId = params.get("pending");
  const record = records.find((item) => item.id === recordId);
  const completed = records.find((item) => item.runId && item.runId === pendingId);

  useEffect(() => {
    if (pendingId && completed) router.replace(`${base}?record=${encodeURIComponent(completed.id)}`);
  }, [pendingId, completed, base, router]);

  useEffect(() => {
    const location = recordId ? `${base}?record=${encodeURIComponent(recordId)}` : pendingId ? `${base}?pending=${encodeURIComponent(pendingId)}` : base;
    localStorage.setItem(lastRecommendationViewKey, location);
  }, [base, recordId, pendingId]);

  const openRecord = (id: string) => router.push(`${base}?record=${encodeURIComponent(id)}`);
  const openPending = (id: string | null) => { if (id) router.push(`${base}?pending=${encodeURIComponent(id)}`); };
  const back = () => router.push(recordId || pendingId ? base : "/rand-recommend?sources=1");

  return { record, recordId, pendingId, openRecord, openPending, back, isDetail: Boolean(recordId), isPending: Boolean(pendingId) };
}
