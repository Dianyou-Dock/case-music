import { MusicSource } from "@/types/constants";
import { SongInfo } from "@/types/song";

const key = "case-music:recommendation-feedback:v2";
const legacyKey = "case-music:recommendation-feedback:v1";
export type FeedbackKind = "liked" | "completed" | "skipped";
export type SourceFeedback = Record<FeedbackKind, string[]>;
export type DislikedTrack = { id: string; artist: string };
type FeedbackStore = Partial<Record<MusicSource, SourceFeedback>>;
const dislikedKey = "case-music:disliked-tracks:v1";
const dislikedArtistsKey = "case-music:disliked-artists:v1";
export type DislikedArtist = { id: string; name: string; aliases: string[] };
const artistKey = (name: string) => name.trim().toLocaleLowerCase().replace(/\s+/g, " ");
let sessionDislikedArtists: DislikedArtist[] = [];

export function getExplicitlyDislikedArtists(): DislikedArtist[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(dislikedArtistsKey) || "[]");
    const stored = Array.isArray(value) ? value.filter((item): item is DislikedArtist =>
      typeof item?.id === "string" && typeof item?.name === "string" && Array.isArray(item?.aliases)) : [];
    return [...sessionDislikedArtists, ...stored.filter(item => !sessionDislikedArtists.some(current => current.id === item.id))];
  } catch { return sessionDislikedArtists; }
}

export function recordDislikedArtist(artist: DislikedArtist) {
  if (typeof window === "undefined") return;
  const existing = getExplicitlyDislikedArtists().filter(item => item.id !== artist.id);
  sessionDislikedArtists = [artist, ...existing];
  try { localStorage.setItem(dislikedArtistsKey, JSON.stringify([artist, ...existing])); }
  catch { /* Keep the current page usable when storage is unavailable. */ }
}

export function isDislikedArtist(artist: { id: string; name: string; aliases?: string[] }): boolean {
  const names = new Set([artist.name, ...(artist.aliases ?? [])].map(artistKey));
  if (getDislikedArtists().some(name => names.has(name))) return true;
  return getExplicitlyDislikedArtists().some(item =>
    item.id === artist.id || [item.name, ...item.aliases].some(name => names.has(artistKey(name))));
}

function normalize(value: unknown): SourceFeedback {
  const data = value && typeof value === "object" ? value as Partial<SourceFeedback> : {};
  return {
    liked: Array.isArray(data.liked) ? data.liked.map(String) : [],
    completed: Array.isArray(data.completed) ? data.completed.map(String) : [],
    skipped: Array.isArray(data.skipped) ? data.skipped.map(String) : [],
  };
}

function readStore(): FeedbackStore {
  if (typeof window === "undefined") return {};
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved) as FeedbackStore;
    const legacy = localStorage.getItem(legacyKey);
    return legacy ? { Netesae: normalize(JSON.parse(legacy)) } : {};
  } catch { return {}; }
}

export function getSourceRecommendationFeedback(source: MusicSource): SourceFeedback {
  return normalize(readStore()[source]);
}

export function recordSourceRecommendationFeedback(source: MusicSource, id: string | number, kind: FeedbackKind) {
  if (typeof window === "undefined") return;
  const store = readStore();
  const feedback = normalize(store[source]);
  const trackId = String(id);
  feedback[kind] = [trackId, ...feedback[kind].filter((item) => item !== trackId)].slice(0, 100);
  if (kind !== "skipped") feedback.skipped = feedback.skipped.filter((item) => item !== trackId);
  store[source] = feedback;
  localStorage.setItem(key, JSON.stringify(store));
}

// NetEase's backend accepts numeric IDs; other providers can keep their native IDs.
export function getRecommendationFeedback() {
  const feedback = getSourceRecommendationFeedback("Netesae");
  return {
    liked: feedback.liked.map(Number).filter(Number.isFinite),
    completed: feedback.completed.map(Number).filter(Number.isFinite),
    skipped: feedback.skipped.map(Number).filter(Number.isFinite),
  };
}

export function recordRecommendationFeedback(song: SongInfo, kind: FeedbackKind) {
  recordSourceRecommendationFeedback(song.type, song.content.id, kind);
}

export function getDislikedTracks(source: MusicSource): DislikedTrack[] {
  if (typeof window === "undefined") return [];
  try {
    const data = JSON.parse(localStorage.getItem(dislikedKey) || "{}")[source];
    return Array.isArray(data) ? data.filter((track): track is DislikedTrack =>
      typeof track?.id === "string" && typeof track?.artist === "string") : [];
  } catch { return []; }
}

export function recordDislikedTrack(source: MusicSource, track: DislikedTrack) {
  if (typeof window === "undefined") return;
  try {
    const store = JSON.parse(localStorage.getItem(dislikedKey) || "{}");
    store[source] = [track, ...getDislikedTracks(source).filter((item) => item.id !== track.id)].slice(0, 100);
    localStorage.setItem(dislikedKey, JSON.stringify(store));
  } catch { /* Feedback still records the song ID when storage is unavailable. */ }
}

export function isDislikedMatch(source: MusicSource, track: DislikedTrack): boolean {
  const feedback = getSourceRecommendationFeedback(source);
  if (feedback.skipped.includes(track.id)) return true;
  const artist = track.artist.trim().toLocaleLowerCase();
  // Artist feedback applies across providers; IDs remain provider-specific.
  return Boolean(artist) && getDislikedArtists().includes(artist);
}

export function getDislikedArtists(): string[] {
  const sources: MusicSource[] = ["Netesae", "Spotify", "QQ", "Apple"];
  return [...new Set([
    ...sources.flatMap((source) => getDislikedTracks(source).map((track) => artistKey(track.artist)).filter(Boolean)),
    ...getExplicitlyDislikedArtists().flatMap(artist => [artist.name, ...artist.aliases].map(artistKey).filter(Boolean)),
  ])];
}
