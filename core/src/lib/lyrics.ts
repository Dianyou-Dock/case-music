export type LyricLine = { time: number; text: string; translation?: string };

export function parseLyrics(lyrics: string[], translations: string[] = []): LyricLine[] {
  const parse = (lines: string[]) => lines.flatMap((line) => {
    const stamps = [...line.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    const text = line.replace(/\[[^\]]+\]/g, "").trim();
    if (!text) return [];
    if (stamps.length === 0) return line.startsWith("[") ? [] : [{ time: 0, text }];
    return stamps.map((stamp) => ({
      time: Number(stamp[1]) * 60 + Number(stamp[2]) +
        Number((stamp[3] || "0").padEnd(3, "0")) / 1000,
      text,
    }));
  });

  const translated = new Map(parse(translations).map((line) => [line.time.toFixed(2), line.text]));
  return parse(lyrics)
    .map((line) => ({ ...line, translation: translated.get(line.time.toFixed(2)) }))
    .sort((a, b) => a.time - b.time);
}
