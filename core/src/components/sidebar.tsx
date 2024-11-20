import { Home, Library, Search } from "lucide-react";
import Link from "next/link";

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

export default function Sidebar() {
  return (
    <div className="flex h-full w-64 flex-col gap-6 border-r bg-card p-4">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <span className="text-primary">♪</span> Fuck Music
      </div>

      <nav className="flex flex-col gap-2">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Home className="h-4 w-4" />
          Home
        </Link>
        <Link
          href="/search"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Search className="h-4 w-4" />
          Search
        </Link>
        <Link
          href="/library"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Library className="h-4 w-4" />
          Library
        </Link>
      </nav>

      <div className="flex flex-col gap-4">
        <h2 className="px-3 text-sm font-semibold">Playlists</h2>
        <div className="flex flex-col gap-1">
          {playlists.map((playlist) => (
            <button
              key={playlist}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {playlist}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}