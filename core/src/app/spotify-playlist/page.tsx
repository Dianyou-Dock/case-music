"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SpotifyTracks } from "@/components/spotify/spotify-tracks";

function Detail() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  if (!/^[A-Za-z0-9]+$/.test(id)) return <p className="p-6">Invalid Spotify playlist.</p>;
  return <SpotifyTracks kind="playlist" id={id} title={params.get("name") ?? "Spotify"} />;
}

export default function SpotifyPlaylistPage() {
  return <Suspense fallback={null}><Detail /></Suspense>;
}
