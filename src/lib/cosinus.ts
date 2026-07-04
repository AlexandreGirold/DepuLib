/**
 * Similarité cosinus calculée en TypeScript (pas de base vectorielle).
 * Le corpus d'amendements est petit (≤ 200) : le calcul en mémoire suffit.
 */
export function cosine(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Embedding pseudo-aléatoire déterministe (hash du texte) — utilisé en mode
 * mock pour que le pipeline de match reste testable sans appel LLM.
 * Dimension 256, valeurs stables pour un même texte.
 */
export function pseudoEmbedding(text: string, dim = 256): number[] {
  const vec = new Array(dim).fill(0);
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  const tokens = normalized.match(/[a-z0-9]+/g) ?? [];
  for (const tok of tokens) {
    let h = 2166136261;
    for (let i = 0; i < tok.length; i++) {
      h ^= tok.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const idx = Math.abs(h) % dim;
    vec[idx] += 1;
    // Deuxième dimension pour un peu de dispersion
    const idx2 = Math.abs(Math.imul(h, 2654435761)) % dim;
    vec[idx2] += 0.5;
  }
  // Normalisation L2
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export function topKByCosine<T extends { embedding?: unknown }>(
  query: number[],
  items: T[],
  getVec: (item: T) => number[] | null,
  k: number
): { item: T; score: number }[] {
  const scored = items
    .map((item) => {
      const vec = getVec(item);
      return { item, score: vec ? cosine(query, vec) : 0 };
    })
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
