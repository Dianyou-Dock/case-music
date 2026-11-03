"use client";

import { Home, Wand, Heart, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useRecommendationNavTap } from "@/hooks/use-recommendation-nav-tap";
import { useRecommendationState } from "@/store/recommendation-task";

const navigationLinks = [
  { href: "/", icon: Home, label: "home" },
  { href: "/liked-playlist", icon: Heart, label: "liked_nav" },
  { href: "/rand-recommend", icon: Wand, label: "recommend_nav" },
  { href: "/settings", icon: Settings, label: "settings" },
];

interface MobileNavProps {
  className?: string;
}

export default function MobileNav({ className }: MobileNavProps) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const handleRecommendationTap = useRecommendationNavTap();
  const { task } = useRecommendationState();

  return (
    <nav className={cn("shrink-0 border-t bg-background", className)}>
      <div className="flex items-center justify-around py-3">
        {navigationLinks.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          const isRecommending = link.href === "/rand-recommend" && task.status === "running";
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={link.href === "/rand-recommend" ? handleRecommendationTap : undefined}
              className={cn(
                "flex flex-col items-center gap-1",
                isRecommending ? "text-purple-500" : isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-6 w-6" />
              <span className="text-xs">{t(isRecommending ? "recommend_loading_nav" : link.label)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
