"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface PlaylistButtonProps {
  name: string;
}

export function PlaylistButton({ name }: PlaylistButtonProps) {
  const pathname = usePathname();
  const i18nKey = name.toLowerCase().replace(/ /g, "_")
  const href = `/${name.toLowerCase().replace(/ /g, "-")}`;
  const isActive = pathname === href;
  const { t } = useTranslation(); // 使用 i18n 的 Hook

  return (
    <Link
      href={href}
      className={cn(
        "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
        isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
      )}
    >
      {t(i18nKey)}
    </Link>
  );
}
