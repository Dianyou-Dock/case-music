"use client";

import { Settings } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AudioSourceCard } from "@/components/audio-source/audio-source-card";
import { useAudioSource } from "@/hooks/use-audio-source";
import {useAiSource} from "@/hooks/use-ai-source.tsx";
import {AiSourceCard} from "@/components/ai-source/ai-source-card.tsx";
import {useTranslation} from "react-i18next";
import {Select, SelectContent, SelectItem, SelectTrigger} from "@/components/ui/select.tsx";
import i18n from "i18next";
import {useEffect, useState} from "react";

export default function SettingsPage() {
  const { audioSource } = useAudioSource();
  const { aiSource } = useAiSource();
  const { t } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState("");

  const changeLanguage = (lng: string) => {
    console.log("into changeLanguage")
    i18n.changeLanguage(lng);
    setCurrentLanguage(lng)
  };

  useEffect(() => {
    const lng = i18n.language;
    setCurrentLanguage(lng)
  })

  return (
    <div className="flex flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Settings className="h-8 w-8" />
          <h1 className="text-3xl font-bold">{t("settings")}</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("setting_music_title")}</CardTitle>
          <CardDescription>{t("setting_music_desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {audioSource?.map((source) => (
              <AudioSourceCard key={source.id} source={source} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("setting_ai_title")}</CardTitle>
          <CardDescription>{t("setting_ai_desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {aiSource?.map((source) => (
              <AiSourceCard key={source.id} source={source} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("setting_select_lang")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <Select value={currentLanguage} onValueChange={changeLanguage}>
              <SelectTrigger>
                {t(currentLanguage)}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh">{t("zh")}</SelectItem>
                <SelectItem value="en">{t("en")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
);
}
