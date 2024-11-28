export type AudioSource = {
  id: string;
  name: string;
  description: string;
};

export const audioSources: AudioSource[] = [
  {
    id: "apple-music",
    name: "Apple Music",
    description: "Connect to your Apple Music account",
  },
  {
    id: "netease-cloudMusic",
    name: "NetEase CloudMusic",
    description: "Connect to your NetEase CloudMusic account",
  },
  {
    id: "qq-music",
    name: "QQ Music",
    description: "Connect to your QQ Music account",
  },
  {
    id: "spotify",
    name: "Spotify",
    description: "Connect to your Spotify account",
  },
];
