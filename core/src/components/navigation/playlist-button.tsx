"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useRecommendationState } from "@/store/recommendation-task";
import { WandSparkles } from "lucide-react";

interface PlaylistButtonProps {
  name: string;
}

export function PlaylistButton({ name }: PlaylistButtonProps) {
  const pathname = usePathname();
  const i18nKey = name.toLowerCase().replace(/ /g, "_")
  const href = `/${name.toLowerCase().replace(/ /g, "-")}`;
  const isActive = pathname === href || pathname.startsWith(`${href}/`);
  const { t } = useTranslation(); // 使用 i18n 的 Hook
  const { task } = useRecommendationState();
  const isRecommending = href === "/rand-recommend" && task.status === "running";

  return (
    <Link
      href={href}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
        isRecommending ? "text-purple-500" : isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
      )}
    >
      <WandSparkles className="h-4 w-4" />{t(isRecommending ? "recommend_loading_nav" : i18nKey)}
    </Link>
  );
}
