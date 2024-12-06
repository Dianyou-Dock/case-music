import { Suspense } from "react";
import { PlaylistContent } from "@/components/playlist/playlist-connect";
import { generateStaticParams } from "./static-params";

export { generateStaticParams };

export default function PlaylistPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <PlaylistContent />
    </Suspense>
  );
}
