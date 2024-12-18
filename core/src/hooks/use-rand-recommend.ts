import useSWR from "swr";
import { invoke } from "@tauri-apps/api/core";
import { MusicSource } from "@/types/constants";
import { PlaylistRes } from "@/types/music";

type Props = {
  source: MusicSource | undefined;
};

const useRandRecommend = ({ source }: Props) => {
  const { data, isLoading, mutate, error } = useSWR(
    source ? ["rand_recommends", source] : null,
    () =>
      invoke<PlaylistRes>("rand_recommends", { source }).then(
        (res) => res.data
      ),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  return {
    data: {
      ...data,
      songs: data?.songs.map((song, idx) => ({
        ...song,
        liked: data?.likeds[idx],
      })),
    },
    isLoading,
    mutate,
    error,
  };
};

export default useRandRecommend;
