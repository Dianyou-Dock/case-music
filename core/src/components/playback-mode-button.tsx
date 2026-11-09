"use client";

import { ListMusic, Repeat, Repeat1, Shuffle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cyclePlaybackMode, usePlaybackMode } from "@/store/playback-mode";

export function PlaybackModeButton() {
  const { t } = useTranslation();
  const mode = usePlaybackMode();
  const labels = {
    "list-once": t("mode_list_once"),
    "list-loop": t("mode_list_loop"),
    "single-loop": t("mode_single_loop"),
    shuffle: t("mode_shuffle"),
  };
  const Icon = mode === "list-loop" ? Repeat : mode === "single-loop" ? Repeat1 : mode === "shuffle" ? Shuffle : ListMusic;
  return <Button type="button" variant="ghost" size="sm" onClick={cyclePlaybackMode} aria-label={`${t("playback_mode")}: ${labels[mode]}`} title={`${t("playback_mode")}: ${labels[mode]}`} className="gap-1 text-green-500"><Icon className="h-5 w-5 shrink-0" /><span className="text-xs">{labels[mode]}</span></Button>;
}
