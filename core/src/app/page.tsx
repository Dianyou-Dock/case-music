import { Music } from "lucide-react";
import FeaturedSection from "@/components/featured-section";
import RecentlyPlayed from "@/components/recently-played";
import TopCharts from "@/components/top-charts";

export default function Home() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <div className="flex items-center gap-4">
        <Music className="h-8 w-8" />
        <h1 className="text-3xl font-bold">Discover</h1>
      </div>
      
      <FeaturedSection />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <RecentlyPlayed />
        <TopCharts />
      </div>
    </div>
  );
}