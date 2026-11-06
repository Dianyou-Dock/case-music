"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { RecommendationRecord } from "@/store/recommendation-task";
import { musicSourceName } from "@/lib/audio-sources";

export function RecommendationHistoryList({ records, onSelect, hideTitle = false }: { records: RecommendationRecord[]; onSelect: (id: string) => void; hideTitle?: boolean }) {
  const { t, i18n } = useTranslation();
  return <div className="flex flex-col gap-4">
    {!hideTitle && <h1 className="text-2xl font-bold">{t("recommend_history")}</h1>}
    {records.length === 0 ? <p className="text-muted-foreground">{t("recommend_history_empty")}</p> : <div className="flex flex-col gap-2">
      {records.map((record) => <Button key={record.id} variant="outline" className="h-auto w-full min-w-0 justify-between gap-3 px-4 py-3 text-left" onClick={() => onSelect(record.id)}>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="truncate font-medium">{record.kind === "sample" ? t("song_recommend_sample", { song: record.song, singer: record.singer }) : t("rand_recommend_title")}</span>
          <span className="text-xs text-muted-foreground">{new Date(record.completedAt).toLocaleString(i18n.language)} · {t("song_count", { count: record.spotifySongs?.length ?? record.qqSongs?.length ?? record.songs.length })}</span>
        </span>
        <span className="shrink-0 rounded-md border px-2 py-1 text-xs text-muted-foreground">{musicSourceName(record.source, i18n.language)}</span>
      </Button>)}
    </div>}
  </div>;
}
