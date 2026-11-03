"use client";

import { Home, Wand, Heart, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

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

  return (
    <nav className={cn("shrink-0 border-t bg-background", className)}>
      <div className="flex items-center justify-around py-3">
        {navigationLinks.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex flex-col items-center gap-1",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-6 w-6" />
              <span className="text-xs">{t(link.label)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
