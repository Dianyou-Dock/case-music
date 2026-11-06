"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ApplicationResp } from "@/types/application";
import { QqSong, useQqPlayback } from "@/hooks/use-qq-playback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Playlist = { id: string; name: string; pic_url: string; kind?: string };
type PlaylistDetail = Playlist & { description: string; songs: QqSong[] };

function message(error: unknown) { return error instanceof Error ? error.message : String(error); }

export default function QqMusicPage() {
  const player = useQqPlayback();
  const [connected, setConnected] = useState(false);
  const [qr, setQr] = useState("");
  const [loginState, setLoginState] = useState("");
  const [keyword, setKeyword] = useState("");
  const [kind, setKind] = useState<"songs" | "playlists">("songs");
  const [songs, setSongs] = useState<QqSong[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [accountPlaylists, setAccountPlaylists] = useState<Playlist[]>([]);
  const [accountLoading, setAccountLoading] = useState(false);
  const [detail, setDetail] = useState<PlaylistDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const polling = useRef(false);

  useEffect(() => {
    void invoke<ApplicationResp<{ connected: boolean }>>("qq_status")
      .then((result) => setConnected(Boolean(result.data?.connected)))
      .catch((cause) => setError(message(cause)));
  }, []);

  useEffect(() => {
    if (!connected) return;
    setAccountLoading(true);
    void invoke<ApplicationResp<{ playlists: Playlist[] }>>("qq_user_playlists")
      .then((result) => { if (!result.data) throw new Error(result.msg || "账号歌单加载失败"); setAccountPlaylists(result.data.playlists); })
      .catch((cause) => setError(message(cause)))
      .finally(() => setAccountLoading(false));
  }, [connected]);

  useEffect(() => {
    if (!qr || connected || loginState === "expired") return;
    let disposed = false;
    const poll = async () => {
      if (polling.current) return;
      polling.current = true;
      try {
        const result = await invoke<ApplicationResp<string>>("qq_login_poll");
        if (disposed) return;
        const state = result.data ?? "";
        setLoginState(state);
        if (state === "connected") { setConnected(true); setQr(""); window.location.reload(); }
      } catch (cause) {
        if (!disposed) { setError(message(cause)); setQr(""); }
      } finally { polling.current = false; }
    };
    const timer = setInterval(() => void poll(), 2500);
    return () => { disposed = true; clearInterval(timer); };
  }, [qr, connected, loginState]);

  const startLogin = async () => {
    setError(""); setLoginState("waiting_scan");
    try {
      const response = await invoke<ApplicationResp<string>>("qq_login_start");
      if (!response.data) throw new Error(response.msg || "无法获取登录二维码");
      setQr(response.data);
    } catch (cause) { setError(message(cause)); }
  };

  const disconnect = async () => {
    try {
      await invoke("qq_disconnect");
      setConnected(false); setQr(""); player.stop();
      window.location.reload();
    } catch (cause) { setError(message(cause)); }
  };

  const search = useCallback(async () => {
    const term = keyword.trim();
    if (!term) return;
    setError(""); setLoading(true); setDetail(null);
    try {
      if (kind === "songs") {
        const response = await invoke<ApplicationResp<{ songs: QqSong[] }>>("qq_search", { keyword: term, offset: 0 });
        if (!response.data) throw new Error(response.msg || "搜索失败");
        setSongs(response.data.songs); setPlaylists([]);
      } else {
        const response = await invoke<ApplicationResp<{ playlists: Playlist[] }>>("qq_search_playlists", { keyword: term });
        if (!response.data) throw new Error(response.msg || "歌单搜索失败");
        setPlaylists(response.data.playlists); setSongs([]);
      }
    } catch (cause) { setError(message(cause)); }
    finally { setLoading(false); }
  }, [keyword, kind]);

  const openPlaylist = async (playlist: Playlist) => {
    setError(""); setLoading(true);
    try {
      const response = await invoke<ApplicationResp<PlaylistDetail>>(playlist.kind ? "qq_user_playlist" : "qq_playlist", { id: playlist.id });
      if (!response.data) throw new Error(response.msg || "歌单加载失败");
      setDetail(response.data);
    } catch (cause) { setError(message(cause)); }
    finally { setLoading(false); }
  };

  const visibleSongs = detail?.songs ?? songs;
  return <div className="space-y-5 p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-3xl font-bold">QQ 音乐</h1><p className="text-sm text-muted-foreground">搜索、歌单和账号内播放</p></div>
      {connected ? <Button variant="outline" onClick={disconnect}>退出 QQ 音乐</Button> : <Button onClick={() => void startLogin()}>扫码登录</Button>}
    </div>
    {qr && <div className="w-fit rounded-lg border bg-white p-4 text-black"><img src={qr} alt="QQ 音乐登录二维码" className="h-48 w-48" /><p className="mt-2 text-center text-sm">{loginState === "waiting_confirm" ? "请在手机上确认登录" : "请使用 QQ 音乐扫码"}</p></div>}
    {loginState === "expired" && <p>二维码已过期，请重新获取。</p>}
    <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void search(); }}>
      <Input className="min-w-40 flex-1" placeholder="搜索歌曲或歌单" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
      <select className="rounded-md border bg-background px-3" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="songs">歌曲</option><option value="playlists">歌单</option></select>
      <Button type="submit" disabled={loading}>搜索</Button>
    </form>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {loading && <p role="status" className="text-muted-foreground">加载中…</p>}
    {connected && !detail && <section className="space-y-3"><h2 className="text-xl font-semibold">我的音乐</h2>{accountLoading && <p className="text-muted-foreground">正在加载账号歌单…</p>}<div className="grid gap-2 sm:grid-cols-2">{accountPlaylists.map((item) => <button key={item.id} type="button" onClick={() => void openPlaylist(item)} className="flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-accent">{item.pic_url && <img src={item.pic_url} alt="" className="h-12 w-12 rounded object-cover" />}<span className="truncate">{item.name}</span></button>)}</div></section>}
    {detail && <div className="flex items-center gap-3"><Button variant="ghost" onClick={() => setDetail(null)}>返回搜索</Button><h2 className="text-xl font-semibold">{detail.name}</h2></div>}
    {!detail && playlists.length > 0 && <div className="grid gap-2 sm:grid-cols-2">{playlists.map((item) => <button key={item.id} type="button" onClick={() => void openPlaylist(item)} className="flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-accent">{item.pic_url && <img src={item.pic_url} alt="" className="h-12 w-12 rounded object-cover" />}<span className="truncate">{item.name}</span></button>)}</div>}
    {visibleSongs.length > 0 && <div className="divide-y rounded-lg border">{visibleSongs.map((song, index) => <button key={`${song.id}-${index}`} type="button" onClick={() => void player.play(visibleSongs, index)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-accent">{song.pic_url && <img src={song.pic_url} alt="" className="h-10 w-10 rounded object-cover" />}<span className="min-w-0 flex-1"><span className="block truncate font-medium">{song.name}</span><span className="block truncate text-sm text-muted-foreground">{song.artists.map((artist) => artist.name).join("、")} · {song.album.name}</span></span><span className="text-sm text-primary">播放</span></button>)}</div>}
  </div>;
}
