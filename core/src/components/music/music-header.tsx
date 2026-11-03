"use client";

import { Play, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";

interface MusicHeaderProps {
  title: string;
  subtitle: string;
  coverUrl?: string;
  handlePlayAllClick: () => void;
  handleRefreshClick: () => void;
  extraAction?: ReactNode;
}

export function MusicHeader({
  title,
  subtitle,
  coverUrl,
  handlePlayAllClick,
  handleRefreshClick,
  extraAction,
}: MusicHeaderProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-end gap-6">
      <div className="h-48 w-48 overflow-hidden rounded-lg bg-accent hidden md:block">
        {coverUrl && (
          <img
            src={coverUrl}
            alt={title}
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div>
          <h1 className="text-4xl font-bold">{title}</h1>
          <p className="text-lg text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex w-full min-w-0 flex-nowrap gap-1.5 sm:gap-3">
          {/* Play All Button */}
          <Button
            size="lg"
            className="min-w-0 flex-1 gap-1 border-2 border-green-500 bg-transparent px-1 text-xs text-green-500 hover:bg-green-100 sm:flex-none sm:gap-2 sm:px-4 sm:text-sm"
            onClick={handlePlayAllClick}
          >
            <Play className="h-4 w-4 shrink-0 sm:h-5 sm:w-5"/> {t("play_all")}
          </Button>

          {/* Refresh Button */}
          <Button
            size="lg"
            className="min-w-0 flex-1 gap-1 border-2 border-purple-500 bg-transparent px-1 text-xs text-purple-500 hover:bg-purple-100 sm:flex-none sm:gap-2 sm:px-4 sm:text-sm"
            onClick={handleRefreshClick}
          >
            <RefreshCcw className="h-4 w-4 shrink-0 sm:h-5 sm:w-5"/> {t("refresh")}
          </Button>
          {extraAction}
        </div>
      </div>
    </div>
  );
}
