"use client";

import { Play, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MusicHeaderProps {
  title: string;
  subtitle: string;
  coverUrl?: string;
  handlePlayAllClick: () => void;
  handleRefreshClick: () => void;
}

export function MusicHeader({
  title,
  subtitle,
  coverUrl,
  handlePlayAllClick,
  handleRefreshClick,
}: MusicHeaderProps) {
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
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-4xl font-bold">{title}</h1>
          <p className="text-lg text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-row gap-4">
          {/* Play All Button */}
          <Button
            size="lg"
            className="w-fit gap-2 bg-transparent border-2 border-green-500 text-green-500 hover:bg-green-100"
            onClick={handlePlayAllClick}
          >
            <Play className="h-5 w-5"/> Play All
          </Button>

          {/* Refresh Button */}
          <Button
            size="lg"
            className="w-fit gap-2 bg-transparent border-2 border-purple-500 text-purple-500 hover:bg-purple-100"
            onClick={handleRefreshClick}
          >
            <RefreshCcw className="h-5 w-5"/> Refresh
          </Button>
        </div>
      </div>
    </div>
  );
}
