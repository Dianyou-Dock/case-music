"use client";

import {Home, Settings} from "lucide-react";
import { usePathname } from "next/navigation";
import { NavigationLink } from "@/components/navigation/navigation-link";
import { PlaylistButton } from "@/components/navigation/playlist-button";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface SidebarProps {
  className?: string;
}

const playlists = [
  "Liked Playlist",
  "Rand Recommend",
];

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

      <nav className="flex flex-col gap-2">
        {navigationLinks.map((link) => (
          <NavigationLink
            key={link.href}
            {...link}
            label={t(link.label)}
            isActive={pathname === link.href}
          />
        ))}
      </nav>

      <div className="flex flex-col gap-4">
        <h2 className="px-3 text-sm font-semibold">{t("playlists")}</h2>
        <div className="flex flex-col gap-1">
          {playlists.map((playlist) => (
            <PlaylistButton key={playlist} name={playlist} />
          ))}
        </div>
      </div>
    </div>
  );
}