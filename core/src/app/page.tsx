"use client";

import { Music } from "lucide-react";
import FeaturedSection from "@/components/featured-section";
import { UserNav } from "@/components/user-nav";
import {useTranslation} from "react-i18next";

export default function Home() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Music className="h-8 w-8" />
          <h1 className="text-2xl md:text-3xl font-bold">{t("home_title")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <UserNav />
        </div>
      </div>

      <FeaturedSection />
    </div>
  );
}
