import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function FeaturedSection() {
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500 to-green-500 p-6 text-white">
      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Featured Album</h2>
            <p className="text-lg opacity-90">Midnight Drive</p>
            <p className="opacity-75">The Synthwave Collection</p>
          </div>
          <Button size="lg" variant="secondary" className="gap-2">
            <Play className="h-5 w-5" /> Play Now
          </Button>
        </div>
      </div>
      <div
        className="absolute inset-0 z-0 bg-cover bg-center opacity-20"
      />
    </div>
  );
}