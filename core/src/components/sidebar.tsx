"use client";

import {Home, Settings, ListMusic, Heart} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavigationLink } from "@/components/navigation/navigation-link";
import { PlaylistButton } from "@/components/navigation/playlist-button";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface SidebarProps {
  className?: string;
}

const navigationLinks = [
  { href: "/", icon: Home, label: "home" },
  // { href: "/search", icon: Search, label: "Search" },
  // { href: "/library", icon: Library, label: "Library" },
  { href: "/settings", icon: Settings, label: "settings" },
];

export default function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <div className={cn("flex h-full w-64 flex-col gap-6 border-r bg-card p-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <span className="text-primary">♪</span> {t("case_music")}
        </div>
      </div>

      <nav className="flex flex-col gap-1 text-sm">
        {navigationLinks.map((link) => (
          <NavigationLink
            key={link.href}
            {...link}
            label={t(link.label)}
            isActive={pathname === link.href}
          />
        ))}
        <Link href="/playlists" className={cn("flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-accent hover:text-accent-foreground", pathname === "/playlists" || pathname === "/playlist-source" || pathname === "/playlist" || pathname === "/spotify-playlist" ? "bg-accent text-accent-foreground" : "text-muted-foreground")}><ListMusic className="h-4 w-4" />{t("playlist_nav")}</Link>
        <Link href="/liked-sources" className={cn("flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-accent hover:text-accent-foreground", pathname === "/liked-sources" || pathname === "/liked-playlist" ? "bg-accent text-accent-foreground" : "text-muted-foreground")}><Heart className="h-4 w-4" />{t("liked_playlist")}</Link>
        <PlaylistButton name="Rand Recommend" />
      </nav>
    </div>
  );
}
