import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAudioSource } from "@/hooks/use-audio-source";
import { useAiSource } from "@/hooks/use-ai-source";
import {
  getRecommendationState,
  showCurrentRecommendationEvent,
  startRandomRecommendation,
} from "@/store/recommendation-task";

const doubleTapInterval = 350;

export function useRecommendationNavTap() {
  const pathname = usePathname();
  const { currentSource } = useAudioSource();
  const { aiSource } = useAiSource();
  const lastTap = useRef(0);

  useEffect(() => {
    if (pathname !== "/rand-recommend") lastTap.current = 0;
  }, [pathname]);

  return () => {
    const now = Date.now();
    const { task } = getRecommendationState();
    const canRecommend = Boolean(currentSource && aiSource?.some((source) => source.used));
    if (now - lastTap.current <= doubleTapInterval) {
      lastTap.current = 0;
      if (currentSource && canRecommend) startRandomRecommendation(currentSource, true);
      window.dispatchEvent(new Event(showCurrentRecommendationEvent));
    } else {
      lastTap.current = now;
      if (currentSource && canRecommend && task.status !== "running" && task.songs.length === 0) {
        startRandomRecommendation(currentSource, task.status !== "idle");
      }
    }
  };
}
