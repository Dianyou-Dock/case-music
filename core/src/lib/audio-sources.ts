export type AudioSource = {
  id: string;
  name: string;
  desc: string;
  connected: boolean;
  disabled: boolean;
};

export function musicSourceName(id: string, locale: string = "zh") {
  const names: Record<string, [string, string]> = {
    Netesae: ["网易云音乐", "NetEase Cloud Music"],
    Spotify: ["Spotify", "Spotify"],
    QQ: ["QQ 音乐", "QQ Music"],
    Apple: ["Apple Music", "Apple Music"],
  };
  return names[id]?.[locale.startsWith("zh") ? 0 : 1] ?? id;
}
