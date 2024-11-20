import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SearchResultsProps {
  query: string;
}

const results = {
  songs: [
    {
      title: "Midnight City",
      artist: "Neon Dreams",
      album: "Night Drive",
      duration: "4:32",
      cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=60&h=60&fit=crop"
    },
    {
      title: "Summer Nights",
      artist: "The Midnight",
      album: "Days of Thunder",
      duration: "3:45",
      cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=60&h=60&fit=crop"
    }
  ],
  artists: [
    {
      name: "The Midnight",
      genre: "Synthwave",
      followers: "1.2M",
      image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop"
    },
    {
      name: "Neon Dreams",
      genre: "Electronic",
      followers: "980K",
      image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&h=100&fit=crop"
    }
  ],
  albums: [
    {
      title: "Night Drive",
      artist: "The Midnight",
      year: "2023",
      tracks: "12 tracks",
      cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=120&h=120&fit=crop"
    },
    {
      title: "Synthwave Dreams",
      artist: "Neon Dreams",
      year: "2022",
      tracks: "10 tracks",
      cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=120&h=120&fit=crop"
    }
  ]
};

export default function SearchResults({ query }: SearchResultsProps) {
  if (query === "") {
    return null;
  }

  return (
    <Tabs defaultValue="songs" className="w-full">
      <TabsList>
        <TabsTrigger value="songs">Songs</TabsTrigger>
        <TabsTrigger value="artists">Artists</TabsTrigger>
        <TabsTrigger value="albums">Albums</TabsTrigger>
      </TabsList>

      <ScrollArea className="h-[600px] pr-4">
        <TabsContent value="songs" className="mt-6">
          <div className="flex flex-col gap-2">
            {results.songs.map((song) => (
              <div
                key={song.title}
                className="flex items-center gap-4 rounded-lg p-2 transition-colors hover:bg-accent"
              >
                <img
                  src={song.cover}
                  alt={song.title}
                  className="h-12 w-12 rounded-md object-cover"
                />
                <div className="flex-1">
                  <h3 className="font-medium">{song.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {song.artist} • {song.album}
                  </p>
                </div>
                <span className="text-sm text-muted-foreground">
                  {song.duration}
                </span>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="artists" className="mt-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {results.artists.map((artist) => (
              <div
                key={artist.name}
                className="flex flex-col items-center gap-3 rounded-lg p-4 text-center transition-colors hover:bg-accent"
              >
                <img
                  src={artist.image}
                  alt={artist.name}
                  className="h-24 w-24 rounded-full object-cover"
                />
                <div>
                  <h3 className="font-medium">{artist.name}</h3>
                  <p className="text-sm text-muted-foreground">{artist.genre}</p>
                  <p className="text-sm text-muted-foreground">
                    {artist.followers} followers
                  </p>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="albums" className="mt-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {results.albums.map((album) => (
              <div
                key={album.title}
                className="flex flex-col gap-3 rounded-lg p-4 transition-colors hover:bg-accent"
              >
                <img
                  src={album.cover}
                  alt={album.title}
                  className="aspect-square rounded-md object-cover"
                />
                <div>
                  <h3 className="font-medium">{album.title}</h3>
                  <p className="text-sm text-muted-foreground">{album.artist}</p>
                  <p className="text-sm text-muted-foreground">
                    {album.year} • {album.tracks}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </ScrollArea>
    </Tabs>
  );
}