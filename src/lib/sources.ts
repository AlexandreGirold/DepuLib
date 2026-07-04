/**
 * Validation serveur des sources — garantie anti-hallucination (§8).
 * Toute source retournée par le LLM est validée : son URL doit appartenir
 * aux URLs fournies dans le contexte. Sinon elle est retirée ; si aucune
 * source valide ne subsiste, le badge « Non sourcé » s'applique.
 */

export type Source = { url: string; titre: string; extrait?: string };

function normalizeUrl(u: string): string {
  return (u ?? "").trim().replace(/\/+$/, "").toLowerCase();
}

/**
 * Filtre les sources : ne garde que celles dont l'URL fait partie des URLs
 * autorisées (celles réellement présentes dans le contexte fourni au LLM).
 */
export function validateSources(
  candidates: unknown,
  allowedUrls: string[]
): Source[] {
  if (!Array.isArray(candidates)) return [];
  const allowed = new Set(allowedUrls.map(normalizeUrl));
  const out: Source[] = [];
  for (const c of candidates) {
    if (!c || typeof c !== "object") continue;
    const url = String((c as any).url ?? "");
    if (!url) continue;
    if (!allowed.has(normalizeUrl(url))) continue;
    out.push({
      url,
      titre: String((c as any).titre ?? (c as any).title ?? "Source officielle"),
      extrait: (c as any).extrait ? String((c as any).extrait) : undefined
    });
  }
  // Déduplication par URL
  const seen = new Set<string>();
  return out.filter((s) => {
    const k = normalizeUrl(s.url);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function hasSources(sources: unknown): boolean {
  return Array.isArray(sources) && sources.length > 0;
}

/** Parse un champ JSON stocké en String (SQLite ne supporte pas le type Json). */
export function parseJsonField<T = unknown>(value: unknown): T | null {
  if (value == null) return null;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/** Sérialise pour stockage en String. */
export function toJsonField(value: unknown): string | null {
  if (value == null) return null;
  return JSON.stringify(value);
}
