import './globals.css';
import type {Metadata} from 'next';
import {Inter} from 'next/font/google';
import {ThemeProvider} from '@/components/theme-provider';
import {AuthProvider} from '@/hooks/use-auth';
import {AudioSourceProvider} from '@/hooks/use-audio-source';
import Player from '@/components/player';
import Sidebar from '@/components/sidebar';
// import {SongInfo} from "@/types/song.ts";

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Modern Music App',
  description: 'A beautiful music streaming experience',
};

// const songInfo: SongInfo = {
//   type: "Netesae",
//   content: {
//     id:26196246,
//     name: "Midnight City",
//     singer: "M83",
//     album: "City Lounge Vol.10",
//     album_id: 2419527,
//     pic_url: "https://p3.music.126.net/ETtFk4cj1jhixX3JrsvnjA==/2316670999761792.jpg",
//     duration: 240000,
//     song_url: "",
//     copyright: "Unknown"
//   }
// }

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <AudioSourceProvider>
              <div className="flex h-screen flex-col">
                <div className="flex flex-1 overflow-hidden">
                  <Sidebar />
                  <main className="flex-1 overflow-y-auto bg-background">{children}</main>
                </div>
                <Player />
              </div>
            </AudioSourceProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}