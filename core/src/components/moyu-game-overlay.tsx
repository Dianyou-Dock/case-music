"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import "@/app/moyu-game/game.css";

export function MoyuGameOverlay() {
  const pathname = usePathname();
  const active = pathname === "/moyu-game";
  const [hasOpened, setHasOpened] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (active) setHasOpened(true);
  }, [active]);

  if (!hasOpened) return null;

  return (
    <section className={`moyu-game-shell absolute inset-0 z-10 overflow-hidden bg-[#05070b] ${active ? "active" : ""}`}>
      <div className="moyu-mobile-header">
        <Link href="/" className="moyu-mobile-back" aria-label={t("moyu_back")}>
          <ArrowLeft className="h-5 w-5" />
          <span>{t("moyu_back")}</span>
        </Link>
      </div>
      <iframe
        title={t("moyu_game")}
        src="/moyu-static/index.html"
        className="moyu-game-frame h-full w-full border-0"
        allow="fullscreen"
      />
    </section>
  );
}
