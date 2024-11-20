import { Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const recentTracks = [
  {
    title: "Midnight City",
    artist: "Neon Dreams",
    duration: "4:32",
    cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=60&h=60&fit=crop"
  },
  {
    title: "Summer Nights",
    artist: "The Midnight",
    duration: "3:45",
    cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=60&h=60&fit=crop"
  },
  {
    title: "Retrowave",
    artist: "Sunset Riders",
    duration: "5:17",
    cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=60&h=60&fit=crop"
  },
];

export default function RecentlyPlayed() {
  return (
    <div className="rounded-xl border bg-card p-6">
      <h2 className="mb-4 text-xl font-semibold">Recently Played</h2>
      <ScrollArea className="h-[300px] pr-4">
        <div className="flex flex-col gap-4">
          {recentTracks.map((track) => (
            <div
              key={track.title}
              className="flex items-center gap-4 rounded-lg p-2 transition-colors hover:bg-accent"
            >
              <img
                src={track.cover}
                alt={track.title}
                className="h-12 w-12 rounded-md object-cover"
              />
              <div className="flex-1">
                <h3 className="font-medium">{track.title}</h3>
                <p className="text-sm text-muted-foreground">{track.artist}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {track.duration}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}