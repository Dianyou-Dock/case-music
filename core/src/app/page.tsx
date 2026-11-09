"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ArrowLeft, History, Music2, Play, RefreshCw, ThumbsDown, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { useAudioSource } from "@/hooks/use-audio-source";
import { useQqPlayback, QqSong } from "@/hooks/use-qq-playback";
import { useSpotifyPlayback } from "@/hooks/use-spotify-playback";
import playerControl from "@/store/player-control";
import { SongInfo } from "@/types/song";
import { SpotifyTrack } from "@/types/spotify-track";
import { PlaylistRes } from "@/types/music";
import { ApplicationResp } from "@/types/application";
import { qqUserPlaylist } from "@/lib/qq-music";
import { musicSourceName } from "@/lib/audio-sources";
import { UserNav } from "@/components/user-nav";
import { getDislikedArtists, isDislikedArtist, recordDislikedArtist } from "@/lib/recommendation-feedback";
import { getPlaybackMode } from "@/store/playback-mode";

type Source = "Netesae" | "QQ" | "Spotify";
type Sample = { title: string; artist: string };
type Artist = { id: string; name: string; aliases?: string[]; country?: string; type?: string; lifeSpan?: { begin?: string } };
type Details = { albums: { title: string; date?: string; type?: string }[]; biography: string; bioChecked?: boolean; image: string; tracks: (SongInfo | QqSong | SpotifyTrack)[] };
type ArtistBatch = { id: number; source: Source; language: string; artists: Artist[] };
const sources: Source[] = ["Netesae", "QQ", "Spotify"];
const cache = new Map<string, Artist[]>();
const imageCache = new Map<string, string>();
const detailsCache = new Map<string, Details>();
type TaskStatus = { key: string; running: boolean; error: string };
let taskStatus: TaskStatus = { key: "", running: false, error: "" };
const taskListeners = new Set<() => void>();
function notifyTask() { for (const listener of taskListeners) listener(); }
const detailKey = (source: Source, language: string, artist: Artist) => source + language + artist.id;
function cachedDetails(source: Source, language: string, artist: Artist): Details | null {
  const key = detailKey(source, language, artist);
  const saved = detailsCache.get(key) ?? readSavedDetails(key);
  if (saved) detailsCache.set(key, saved);
  return saved;
}
function detailsReady(source: Source, language: string, artist: Artist): boolean {
  const details = cachedDetails(source, language, artist);
  return Boolean(details && (details.biography.trim() || details.bioChecked));
}
async function prefetchDetails(source: Source, language: string, artists: Artist[]) {
  for (let offset = 0; offset < artists.length; offset += 3) {
    await Promise.all(artists.slice(offset, offset + 3).map(async artist => {
      const key = detailKey(source, language, artist);
      const cached = cachedDetails(source, language, artist);
      if (cached) {
        if (cached.biography.trim() || cached.bioChecked) return;
        let biography = "";
        try {
          const response = await invoke<ApplicationResp<string>>("daily_artist_biography", { req: { id: artist.id, name: artist.name, language } });
          if (response.code !== 0) throw new Error(response.msg || "Artist biography unavailable");
          biography = response.data ?? "";
        } catch (cause) { console.warn("Artist biography prefetch failed", artist.name, cause); }
        const updated = { ...cached, biography, bioChecked: true };
        detailsCache.set(key, updated);
        saveDetails(key, updated);
        return;
      }
      let details: Details;
      try {
        const response = await invoke<ApplicationResp<Details>>("daily_artist_details", { req: { id: artist.id, name: artist.name, source, language } });
        if (response.code !== 0 || !response.data) throw new Error(response.msg || "Artist details unavailable");
        details = response.data;
      } catch (cause) {
        console.warn("Artist prefetch failed", artist.name, cause);
        details = { albums: [], biography: "", bioChecked: true, image: "", tracks: [] };
      }
      detailsCache.set(key, details);
      saveDetails(key, details);
      if (details.image) imageCache.set(artist.id, details.image);
    }));
    notifyTask();
  }
  saveImages();
}
function startHydrationTask(source: Source, language: string, artists: Artist[]): boolean {
  if (taskStatus.running) return false;
  const key = source + language;
  taskStatus = { key, running: true, error: "" };
  notifyTask();
  void prefetchDetails(source, language, artists).catch(cause => {
    console.warn("Artist prefetch stopped", cause);
  }).finally(() => {
    taskStatus = { key, running: false, error: "" };
    notifyTask();
  });
  return true;
}
function startArtistTask(source: Source, language: string, zh: boolean): boolean {
  if (taskStatus.running) return false;
  const key = source + language;
  taskStatus = { key, running: true, error: "" };
  notifyTask();
  void (async () => {
    try {
      const liked = await likedSongs(source);
      const excluded = [...new Set([...liked.flatMap(song => splitArtists(song.artist)), ...getDislikedArtists()])];
      const samples = shuffle(liked).slice(0, 15);
      if (!samples.length) throw new Error(zh ? "喜爱列表暂无歌曲" : "Your liked list has no songs");
      const response = await invoke<ApplicationResp<Artist[]>>("daily_artists", { req: { samples, excluded_artists: excluded, language } });
      if (response.code !== 0 || !response.data) throw new Error(response.msg || "Artist discovery failed");
      const allowed = response.data.filter(artist => !isDislikedArtist(artist));
      if (!allowed.length) throw new Error(zh ? "暂未找到新的艺人，请重试" : "No new artists found; please retry");
      await prefetchDetails(source, language, allowed);
      cache.set(key, allowed);
      saveBatch({ id: Date.now(), source, language, artists: response.data });
      taskStatus = { key, running: false, error: "" };
    } catch (cause) {
      taskStatus = { key, running: false, error: String(cause) };
    }
    notifyTask();
  })();
  return true;
}
const historyKey = "case-music:daily-artist-history:v1";
const detailsKey = "case-music:daily-artist-details:v1:";
const imagesKey = "case-music:daily-artist-images:v1";
function imageFor(id: string): string {
  if (imageCache.has(id)) return imageCache.get(id)!;
  if (typeof window === "undefined") return "";
  try {
    const value = JSON.parse(localStorage.getItem(imagesKey) || "{}")[id];
    if (typeof value === "string") { imageCache.set(id, value); return value; }
  } catch { /* Request the image again. */ }
  return "";
}
function saveImages() {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(imagesKey, JSON.stringify(Object.fromEntries(imageCache))); }
  catch { /* Keep images for this session. */ }
}
function readHistory(): ArtistBatch[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(historyKey) || "[]");
    return Array.isArray(value) ? value.filter((item): item is ArtistBatch =>
      typeof item?.id === "number" && typeof item?.source === "string" && typeof item?.language === "string" && Array.isArray(item?.artists)) : [];
  } catch { return []; }
}
function saveBatch(batch: ArtistBatch) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(historyKey, JSON.stringify([batch, ...readHistory()])); }
  catch { /* Keep the current recommendation available in memory. */ }
}
function readSavedDetails(key: string): Details | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(localStorage.getItem(detailsKey + key) || "null");
    return value && Array.isArray(value.tracks) ? value as Details : null;
  } catch { return null; }
}
function saveDetails(key: string, details: Details) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(detailsKey + key, JSON.stringify(details)); }
  catch { /* In-memory cache still avoids repeat requests in this session. */ }
}
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    const j = value[0] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function splitArtists(name: string): string[] {
  return name.split(/[,、/&；;]|\s+(?:feat\.?|ft\.?|and|with|x)\s+/i).map(value => value.trim()).filter(Boolean);
}
async function likedSongs(source: Source): Promise<Sample[]> {
  if (source === "QQ") {
    const data = await qqUserPlaylist("qq-liked:201");
    return data.songs.map(song => ({ title: song.name, artist: song.artists.map(artist => artist.name).join("、") }));
  }
  if (source === "Spotify") {
    const samples: Sample[] = [];
    const first = await invoke<ApplicationResp<{ items: { track?: SpotifyTrack; item?: SpotifyTrack }[]; total: number }>>("spotify_saved_tracks", { offset: 0 });
    if (first.code !== 0 || !first.data) throw new Error(first.msg || "Spotify library unavailable");
    const pages = shuffle(Array.from({ length: Math.ceil(first.data.total / 50) }, (_, index) => index));
    for (const page of pages) {
      const response = page === 0 ? first : await invoke<typeof first>("spotify_saved_tracks", { offset: page * 50 });
      if (response.code !== 0 || !response.data) continue;
      samples.push(...response.data.items.map(item => item.track ?? item.item).filter((song): song is SpotifyTrack => Boolean(song?.id)).map(song => ({ title: song.name, artist: song.artists.map(artist => artist.name).join("、") })));
    }
    return samples;
  }
  const response = await invoke<PlaylistRes>("like_list", { req: { source, offset: 0, limit: 0 } });
  if (response.code !== 0 || !response.data) throw new Error(response.msg || "NetEase library unavailable");
  return response.data.songs.map(song => ({ title: song.content.name, artist: song.content.singer }));
}

export default function Home() {
  const { i18n } = useTranslation();
  const zh = (i18n.language ?? "zh").startsWith("zh");
  const { audioSource } = useAudioSource();
  const qq = useQqPlayback();
  const spotify = useSpotifyPlayback();
  const connected = useMemo(() => sources.filter(source => audioSource?.some(item => item.id === source && item.connected)), [audioSource]);
  const [source, setSource] = useState<Source | null>(null);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [images, setImages] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Artist | null>(null);
  const [details, setDetails] = useState<Details | null>(null);
  const [taskRevision, setTaskRevision] = useState(0);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");
  const [playError, setPlayError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [, setHistoryVersion] = useState(0);
  const [playAllProgress, setPlayAllProgress] = useState("");
  const language = zh ? "zh" : "en";
  const loading = taskStatus.running;
  useEffect(() => {
    const listener = () => setTaskRevision(value => value + 1);
    taskListeners.add(listener);
    return () => { taskListeners.delete(listener); };
  }, []);
  useEffect(() => { if (connected.length && (!source || !connected.includes(source))) setSource(connected[0]); }, [connected, source]);
  useEffect(() => {
    if (!source) return;
    const key = source + language;
    const previous = cache.get(key) ?? readHistory().find(batch => batch.source === source && batch.language === language && batch.artists.length > 0)?.artists;
    if (previous) {
      const allowed = previous.filter(artist => !isDislikedArtist(artist));
      cache.set(key, allowed); setArtists(allowed);
      setImages(Object.fromEntries(allowed.map(artist => [artist.id, imageFor(artist.id)])));
      if (!taskStatus.running && allowed.some(artist => !detailsReady(source, language, artist))) startHydrationTask(source, language, allowed);
    } else setArtists([]);
    setError(taskStatus.key === key ? taskStatus.error : "");
    if (!previous && !taskStatus.running && taskStatus.key !== key) startArtistTask(source, language, zh);
  }, [source, language, taskRevision, zh]);
  const refresh = useCallback(() => { if (source) startArtistTask(source, language, zh); }, [source, language, zh]);
  function dislikeArtist(artist: Artist) {
    recordDislikedArtist({ id: artist.id, name: artist.name, aliases: artist.aliases ?? [] });
    for (const [key, value] of cache) cache.set(key, value.filter(item => !isDislikedArtist(item)));
    setArtists(current => current.filter(item => !isDislikedArtist(item)));
    setHistoryVersion(value => value + 1);
    if (selected?.id === artist.id) { setSelected(null); setDetails(null); }
  }
  const batchHistory = readHistory().filter(batch => batch.source === source && batch.language === language);
  function restoreBatch(batch: ArtistBatch) {
    const allowed = batch.artists.filter(artist => !isDislikedArtist(artist));
    if (!source) return;
    cache.set(source + language, allowed);
    setArtists(allowed);
    setImages(Object.fromEntries(allowed.map(artist => [artist.id, imageFor(artist.id)])));
    setHistoryOpen(false); setError("");
    if (!taskStatus.running && allowed.some(artist => !detailsReady(source, language, artist))) startHydrationTask(source, language, allowed);
  }
  async function loadDetails(artist: Artist, activeSource: Source): Promise<Details> {
    return cachedDetails(activeSource, language, artist) ?? { albums: [], biography: "", image: "", tracks: [] };
  }
  async function openArtist(artist: Artist) {
    if (!source || !detailsReady(source, language, artist)) return;
    setSelected(artist); setDetails(null); setPlayError("");
    setDetailsLoading(true);
    try {
      const result = await loadDetails(artist, source);
      if (!isDislikedArtist(artist)) setDetails(result);
    } catch (cause) { setError(String(cause)); }
    finally { setDetailsLoading(false); }
  }
  async function playTracks(tracks: Details["tracks"], index: number) {
    if (!source || !tracks.length) return;
    setPlayError("");
    try {
      if (source === "QQ") await qq.play(tracks as QqSong[], index);
      else if (source === "Spotify") {
        const spotifyTracks = tracks as SpotifyTrack[];
        const mode = getPlaybackMode();
        const queue = mode === "list-loop" || mode === "shuffle" ? spotifyTracks.slice(index).concat(spotifyTracks.slice(0, index)) : spotifyTracks.slice(index);
        await spotify.play({ trackIds: queue.map(track => track.id), queueTracks: queue });
      } else {
        playerControl.set.songs(tracks as SongInfo[]);
        playerControl.set.index(index);
        playerControl.set.restartKey(playerControl.get.restartKey() + 1);
        playerControl.set.play();
      }
    } catch (cause) { setPlayError(String(cause)); }
  }
  async function play(index: number) { if (details) await playTracks(details.tracks, index); }
  async function playAllArtists() {
    if (!source || !artists.length || playAllProgress || artists.some(artist => !detailsReady(source, language, artist))) return;
    setPlayError("");
    const active = artists.filter(artist => !isDislikedArtist(artist));
    setPlayAllProgress(zh ? `正在收集曲目 0/${active.length}` : `Collecting tracks 0/${active.length}`);
    const allTracks: Details["tracks"] = [];
    const seenTracks = new Set<string>();
    let completed = 0;
    for (let offset = 0; offset < active.length; offset += 3) {
      const group = active.slice(offset, offset + 3);
      const results = await Promise.allSettled(group.map(artist => loadDetails(artist, source)));
      for (const result of results) {
        if (result.status === "fulfilled") for (const track of result.value.tracks) {
          const id = source === "Netesae" ? String((track as SongInfo).content.id) : (track as QqSong | SpotifyTrack).id;
          if (!seenTracks.has(id)) { seenTracks.add(id); allTracks.push(track); }
        }
        completed++;
        setPlayAllProgress(zh ? `正在收集曲目 ${completed}/${active.length}` : `Collecting tracks ${completed}/${active.length}`);
      }
    }
    setPlayAllProgress("");
    if (!allTracks.length) { setPlayError(zh ? "当前音源没有找到可播放曲目" : "No playable tracks found"); return; }
    await playTracks(allTracks, 0);
  }
  const trackName = (song: SongInfo | QqSong | SpotifyTrack) => source === "Netesae" ? (song as SongInfo).content.name : (song as QqSong | SpotifyTrack).name;
  return <div className="min-h-full p-4 pb-10 pt-16 md:p-6">
    <div className="mb-6 flex items-start justify-between gap-4">
      <div><p className="text-sm text-purple-400">{zh ? "音乐信息推荐" : "Music discovery"}</p><h1 className="text-2xl font-bold md:text-3xl">{zh ? "发现新的音乐人" : "Discover new artists"}</h1></div><UserNav />
    </div>
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {connected.map(item => <button key={item} onClick={() => { setSource(item); setSelected(null); }} className={`rounded-lg border px-4 py-2 text-sm ${source === item ? "border-purple-500 bg-purple-500/15 text-white" : "border-white/30 text-muted-foreground"}`}>{musicSourceName(item, language)}</button>)}
      {source && <div className="ml-auto flex flex-wrap gap-2">
        <button className="flex items-center gap-2 rounded-lg border border-green-500 px-4 py-2 text-sm text-green-400 disabled:opacity-50" onClick={() => void playAllArtists()} disabled={!artists.length || Boolean(playAllProgress) || artists.some(artist => !detailsReady(source, language, artist))}><Play size={16} />{playAllProgress || (zh ? "一键播放全部" : "Play all")}</button>
        <button className="flex items-center gap-2 rounded-lg border border-white/60 px-4 py-2 text-sm" onClick={() => setHistoryOpen(true)}><History size={16} />{zh ? "推荐记录" : "History"}</button>
        <button className="flex items-center gap-2 rounded-lg border border-purple-500 px-4 py-2 text-sm text-purple-400 disabled:cursor-not-allowed disabled:opacity-50" onClick={refresh} disabled={loading}><RefreshCw size={16} />{zh ? "换一批" : "Refresh"}</button>
      </div>}
    </div>
    {!audioSource && <p className="text-muted-foreground">{zh ? "正在检查音源…" : "Checking music sources…"}</p>}
    {audioSource && !connected.length && <p className="rounded-xl border border-white/20 p-8 text-center text-muted-foreground">{zh ? "请先在设置中连接音乐音源。" : "Connect a music source in Settings."} <Link href="/settings" className="underline">{zh ? "去设置" : "Settings"}</Link></p>}
    {loading && <p className="text-muted-foreground">{zh ? "正在准备艺人资料和可播放歌曲…" : "Preparing artist details and playable tracks…"}</p>}
    {error && <p role="alert" className="mb-4 text-red-400">{error} <button onClick={refresh} disabled={loading} className="underline disabled:opacity-50">{zh ? "重试" : "Retry"}</button></p>}
    <div className="grid auto-rows-[100px] grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {artists.map((artist, index) => <article key={artist.id} className={`relative overflow-hidden rounded-xl border border-white/20 bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 hover:border-purple-500 ${index % 7 === 0 ? "col-span-2 row-span-3" : "row-span-2"}`}>
        <button onClick={() => void openArtist(artist)} disabled={!source || !detailsReady(source, language, artist)} className="relative flex h-full w-full flex-col justify-end p-4 text-left disabled:opacity-60" aria-label={zh ? `查看${artist.name}` : `View ${artist.name}`}>
          {images[artist.id] && <img src={images[artist.id]} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" loading="lazy" />}
          {images[artist.id] && <span className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />}
          <Music2 className="absolute right-4 top-4 h-12 w-12 text-purple-500/40" />
          <span className="relative line-clamp-2 text-xl font-bold text-white">{artist.name}</span>
          <span className="relative mt-2 text-sm text-white/70">{[artist.country, artist.lifeSpan?.begin?.slice(0, 4)].filter(Boolean).join(" · ")}</span>
        </button>
        <button onClick={() => dislikeArtist(artist)} className="absolute right-3 top-3 z-10 rounded-lg border border-white/60 bg-black/70 p-2 text-white hover:border-purple-400" aria-label={zh ? `不喜欢${artist.name}` : `Dislike ${artist.name}`} title={zh ? "不喜欢此歌手" : "Dislike this artist"}><ThumbsDown size={17} /></button>
      </article>)}
    </div>
    {historyOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setHistoryOpen(false)}><section role="dialog" aria-modal="true" aria-label={zh ? "推荐记录" : "Recommendation history"} className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/25 bg-background p-5" onClick={event => event.stopPropagation()}>
      <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">{zh ? "推荐记录" : "Recommendation history"}</h2><button aria-label={zh ? "关闭" : "Close"} onClick={() => setHistoryOpen(false)}><X size={18} /></button></div>
      {!batchHistory.length && <p className="text-muted-foreground">{zh ? "暂无记录" : "No history yet"}</p>}
      <div className="divide-y divide-white/15">{batchHistory.map(batch => <button key={batch.id} onClick={() => restoreBatch(batch)} className="flex w-full items-center justify-between py-3 text-left text-sm hover:text-purple-300"><span>{new Date(batch.id).toLocaleString(language)}</span><span>{batch.artists.filter(artist => !isDislikedArtist(artist)).length} {zh ? "位艺人" : "artists"}</span></button>)}</div>
    </section></div>}
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setSelected(null)}><section role="dialog" aria-modal="true" aria-label={selected.name} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/25 bg-background p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
      <div className="mb-4 flex justify-between"><button className="flex items-center gap-2 text-sm" onClick={() => setSelected(null)}><ArrowLeft size={16} />{zh ? "返回" : "Back"}</button><button aria-label={zh ? "关闭" : "Close"} onClick={() => setSelected(null)}><X size={18} /></button></div>
      {details?.image && <img src={details.image} alt="" className="mb-4 aspect-[16/9] w-full rounded-xl object-cover" />}
      <div className="flex items-center justify-between gap-3"><h2 className="text-2xl font-bold">{selected.name}</h2><button onClick={() => dislikeArtist(selected)} className="flex items-center gap-2 rounded-lg border border-white/60 px-3 py-2 text-sm hover:border-purple-400"><ThumbsDown size={16} />{zh ? "不喜欢" : "Dislike"}</button></div>
      {detailsLoading && <p className="mt-4 text-muted-foreground">{zh ? "正在读取艺人资料与可播放曲目…" : "Loading artist information and playable tracks…"}</p>}
      {details && <><p className="mt-4 whitespace-pre-line text-sm leading-6 text-muted-foreground">{details.biography || (zh ? "暂无艺人简介" : "No biography available")}</p>
        {!!details.albums.length && <div className="mt-5"><h3 className="font-semibold">{zh ? "发行资料" : "Releases"}</h3><div className="mt-2 flex flex-wrap gap-2">{details.albums.map((album, index) => <span key={index} className="rounded border border-white/20 px-2 py-1 text-xs">{album.title} · {album.date || "—"}</span>)}</div></div>}
        <div className="mt-6 flex items-center justify-between"><h3 className="font-semibold">{zh ? "推荐曲目" : "Recommended tracks"}</h3><button disabled={!details.tracks.length} onClick={() => void play(0)} className="flex items-center gap-2 rounded-lg border border-green-500 px-3 py-2 text-sm text-green-400 disabled:opacity-50"><Play size={16} />{zh ? "播放该艺人全部曲目" : "Play all tracks"}</button></div>
        <div className="mt-3 divide-y divide-white/15">{details.tracks.map((song, index) => <button key={index} onClick={() => void play(index)} className="flex w-full items-center justify-between py-3 text-left text-sm"><span>{index + 1}. {trackName(song)}</span><Play size={16} /></button>)}</div>
        {!details.tracks.length && <p className="mt-3 text-sm text-muted-foreground">{zh ? "当前音源暂未找到可播放曲目" : "No playable tracks found in this source"}</p>}
      </>}
      {playError && <p role="alert" className="mt-3 text-red-400">{playError}</p>}
    </section></div>}
  </div>;
}
