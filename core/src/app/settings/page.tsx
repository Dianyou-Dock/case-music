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

export default function SettingsPage() {
  const { audioSource } = useAudioSource();
  const { aiSource } = useAiSource();

  return (
    <div className="flex flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Settings className="h-8 w-8" />
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Audio Sources</CardTitle>
          <CardDescription>
            Configure your preferred music streaming service. Only one source
            can be connected at a time.
          </CardDescription>
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
          <CardTitle>Ai Sources</CardTitle>
          <CardDescription>
            Configure your preferred ai streaming service. Only one source
            can be connected at a time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {aiSource?.map((source) => (
              <AiSourceCard key={source.id} source={source} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
