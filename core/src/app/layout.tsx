import "./globals.css";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/hooks/use-auth";
import { AudioSourceProvider } from "@/hooks/use-audio-source";
import Player from "@/components/player";
import Sidebar from "@/components/sidebar";
import { AiSourceProvider } from "@/hooks/use-ai-source.tsx";

import "@/hooks/i18n.ts"; // 导入 I18nProvider

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh" suppressHydrationWarning>
    <body className={inter.className}>
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >

      <AuthProvider>
        <AudioSourceProvider>
          <AiSourceProvider>
            <div className="flex h-screen flex-col">
              <div className="flex flex-1 overflow-hidden">
                <Sidebar/>
                <main className="flex-1 overflow-y-auto bg-background">
                  {children}
                </main>
              </div>
              <Player/>
            </div>
          </AiSourceProvider>
        </AudioSourceProvider>
      </AuthProvider>

    </ThemeProvider>
    </body>
    </html>
  );
}
