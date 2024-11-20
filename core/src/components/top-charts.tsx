import { Trophy } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const topTracks = [
  {
    rank: 1,
    title: "Neon Dreams",
    artist: "Synthwave Masters",
    plays: "1.2M",
    cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=60&h=60&fit=crop"
  },
  {
    rank: 2,
    title: "Night Drive",
    artist: "Retro Synth",
    plays: "980K",
    cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=60&h=60&fit=crop"
  },
  {
    rank: 3,
    title: "Future City",
    artist: "Digital Dreams",
    plays: "754K",
    cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=60&h=60&fit=crop"
  },
];

export default function TopCharts() {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-yellow-500" />
        <h2 className="text-xl font-semibold">Top Charts</h2>
      </div>
      <ScrollArea className="h-[300px] pr-4">
        <div className="flex flex-col gap-4">
          {topTracks.map((track) => (
            <div
              key={track.title}
              className="flex items-center gap-4 rounded-lg p-2 transition-colors hover:bg-accent"
            >
              <span className="w-6 text-center font-bold text-muted-foreground">
                {track.rank}
              </span>
              <img
                src={track.cover}
                alt={track.title}
                className="h-12 w-12 rounded-md object-cover"
              />
              <div className="flex-1">
                <h3 className="font-medium">{track.title}</h3>
                <p className="text-sm text-muted-foreground">{track.artist}</p>
              </div>
              <div className="text-sm text-muted-foreground">{track.plays}</div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}