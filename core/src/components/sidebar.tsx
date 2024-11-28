"use client";

import { Home, Library, Search, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import { NavigationLink } from "@/components/navigation/navigation-link";
import { PlaylistButton } from "@/components/navigation/playlist-button";

const playlists = [
  "Recently Added",
  "Recently Played",
  "Top Songs",
  "Favorites",
  "Workout Mix",
  "Chill Vibes",
  "Road Trip",
  "90s Hits",
];

const navigationLinks = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/library", icon: Library, label: "Library" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col gap-6 border-r bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <span className="text-primary">♪</span> Fuck Music
        </div>
      </div>

      <nav className="flex flex-col gap-2">
        {navigationLinks.map((link) => (
          <NavigationLink
            key={link.href}
            {...link}
            isActive={pathname === link.href}
          />
        ))}
      </nav>

      <div className="flex flex-col gap-4">
        <h2 className="px-3 text-sm font-semibold">Playlists</h2>
        <div className="flex flex-col gap-1">
          {playlists.map((playlist) => (
            <PlaylistButton key={playlist} name={playlist} />
          ))}
        </div>
      </div>
    </div>
  );
}