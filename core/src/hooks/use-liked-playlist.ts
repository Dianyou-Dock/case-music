import useSWR from "swr";
import { invoke } from "@tauri-apps/api/core";
import { MusicSource } from "@/types/constants";
import { PlaylistRes } from "@/types/music";

type Props = {
  source: MusicSource | undefined;
  pageIndex: number;
};

const useLikedPlaylist = ({ source, pageIndex }: Props) => {
  const { data, isLoading, mutate, error } = useSWR(
    source ? ["like_list", source, pageIndex] : null,
    () =>
      invoke<PlaylistRes>("like_list", {
        req: { source, offset: pageIndex, limit: 100 },
      }).then((res) => res.data)
  );

  return {
    data: {
      ...data,
      songs: data?.songs.map((song) => ({ ...song, liked: true })),
    },
    isLoading,
    mutate,
    error,
  };
};

export default useLikedPlaylist;
