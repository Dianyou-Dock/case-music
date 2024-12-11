import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {Playlist} from "@/types/music.ts";
import {playerControl} from "@/components/player-control";
import {defaultLimit, MusicSource} from "@/types/constants.ts";

interface MusicHeaderProps {
  title: string;
  subtitle: string;
  coverUrl?: string;
  playlist: Playlist | undefined;
  source: MusicSource,
}

export function MusicHeader({ title, subtitle, coverUrl, playlist, source }: MusicHeaderProps) {

  const handlePlayAllClick = () => {
    if (playlist != undefined) {
      playerControl.setState({
        playListInfo: {
          type: source,
          list_id: playlist.id,
          page_index: 0, // start
          limit: defaultLimit,
        },
        songs: playlist.songs,
        current: playlist.songs[0],
        immediately: undefined,
      });
    }
  }

  return (
    <div className="flex items-end gap-6">
      <div className="h-48 w-48 overflow-hidden rounded-lg bg-accent">
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
        <Button
            size="lg"
            className="w-fit gap-2"
            onClick={handlePlayAllClick}
        >
          <Play className="h-5 w-5" /> Play All
        </Button>
      </div>
    </div>
  );
}
