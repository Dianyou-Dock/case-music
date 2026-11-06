"use client";

import { ThumbsDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { MusicSource } from "@/types/constants";
import { recordSourceRecommendationFeedback } from "@/lib/recommendation-feedback";

export function RecommendationDislikeButton({ source, id, name, onDislike }: {
  source: MusicSource;
  id: string | number;
  name: string;
  onDislike?: () => void;
}) {
  const { t } = useTranslation();
  const label = t("recommend_dislike", { name });
  return <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={label} title={label} onClick={(event) => {
    event.stopPropagation();
    recordSourceRecommendationFeedback(source, id, "skipped");
    onDislike?.();
  }}><ThumbsDown className="h-4 w-4" /></Button>;
}
