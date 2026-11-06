"use client";

import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UnifiedMusicList } from "@/components/music/unified-music-list";
import { QqSong, useQqPlayback } from "@/hooks/use-qq-playback";

export function QqMusicList({ songs }: { songs: QqSong[] }) {
  const player = useQqPlayback();
  return <UnifiedMusicList
    items={songs}
    row={(song) => ({ key: song.id, name: song.name, artist: song.artists.map((artist) => artist.name).join("、"), album: song.album.name, style: "", releaseDate: null, durationMs: 0, imageUrl: song.pic_url })}
    actions={(_song, index, showPlay) => showPlay && <Button variant="ghost" size="icon" aria-label={`播放${songs[index].name}`} onClick={(event) => { event.stopPropagation(); void player.play(songs, index); }}><Play className="h-4 w-4" /></Button>}
    onPlay={(_song, index) => void player.play(songs, index)}
  />;
}
