export function normalizeText(value: string | undefined | null): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[　\s]+/g, ' ')
    .trim();
}

export function tokenize(value: string): string[] {
  return Array.from(
    new Set(
      normalizeText(value)
        .split(/[^a-z0-9+#.一-龥]+/i)
        .map((part) => part.trim())
        .filter(Boolean)
    )
  );
}

export function includesNormalized(haystack: string | undefined, needle: string | undefined): boolean {
  const target = normalizeText(needle);
  if (!target) return false;
  return normalizeText(haystack).includes(target);
}

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function uniqueBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

export function stableId(parts: Array<string | number | undefined>): string {
  const source = parts.map((part) => normalizeText(String(part ?? ''))).join('|');
  let hash = 2166136261;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0).toString(36);
}

export function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}
