// Reading-time helper (UI-SPEC §9). Single budget: 200 wpm, minimum 1 minute.

export function readingTime(words: number): number {
  return Math.max(1, Math.ceil(words / 200));
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
