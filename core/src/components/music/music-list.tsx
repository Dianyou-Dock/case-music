import { Clock, Heart, MoreHorizontal, Play } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Track } from "@/types/music";
import { formatDuration } from "@/lib/format";

interface MusicListProps {
  tracks: Track[];
}

export function MusicList({ tracks }: MusicListProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40px]">#</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Artist</TableHead>
          <TableHead>Album</TableHead>
          <TableHead className="w-[100px]">
            <Clock className="h-4 w-4" />
          </TableHead>
          <TableHead className="w-[100px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tracks.map((track, index) => (
          <TableRow key={track.id}>
            <TableCell>{index + 1}</TableCell>
            <TableCell>
              <div className="flex items-center gap-3">
                <img
                  src={track.coverUrl}
                  alt={track.title}
                  className="h-10 w-10 rounded object-cover"
                />
                <span className="font-medium">{track.title}</span>
              </div>
            </TableCell>
            <TableCell>{track.artist}</TableCell>
            <TableCell>{track.album}</TableCell>
            <TableCell>{formatDuration(track.duration)}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Heart className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Play className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
