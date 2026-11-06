"use client";

import { Home, Wand, Heart, Settings, ListMusic, Music2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useRecommendationState } from "@/store/recommendation-task";

const navigationLinks = [
  { href: "/", icon: Home, label: "home" },
  { href: "/liked-sources", icon: Heart, label: "liked_nav" },
  { href: "/playlists", icon: ListMusic, label: "playlist_nav" },
  { href: "/qq-music", icon: Music2, label: "QQ 音乐" },
  { href: "/rand-recommend", icon: Wand, label: "recommend_nav" },
  { href: "/settings", icon: Settings, label: "settings" },
];

interface MobileNavProps {
  className?: string;
}

export default function MobileNav({ className }: MobileNavProps) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { task } = useRecommendationState();

  return (
    <nav className={cn("shrink-0 border-t bg-background", className)}>
      <div className="flex items-center justify-around py-3">
        {navigationLinks.map((link) => {
          const isActive = pathname === link.href || (link.href === "/rand-recommend" && pathname.startsWith("/rand-recommend/")) || (link.href === "/liked-sources" && pathname === "/liked-playlist") || (link.href === "/playlists" && (pathname === "/playlist" || pathname === "/playlist-source" || pathname === "/spotify-playlist"));
          const Icon = link.icon;
          const isRecommending = link.href === "/rand-recommend" && task.status === "running";
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex flex-col items-center gap-1",
                isRecommending ? "text-purple-500" : isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-6 w-6" />
              <span className="text-xs">{link.href === "/qq-music" ? link.label : t(isRecommending ? "recommend_loading_nav" : link.label)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
