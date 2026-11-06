import { MusicSource } from "@/types/constants";
import { SongInfo } from "@/types/song";

const key = "case-music:recommendation-feedback:v2";
const legacyKey = "case-music:recommendation-feedback:v1";
export type FeedbackKind = "liked" | "completed" | "skipped";
export type SourceFeedback = Record<FeedbackKind, string[]>;
type FeedbackStore = Partial<Record<MusicSource, SourceFeedback>>;

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
