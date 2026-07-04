// Version CommonJS de pseudoEmbedding (miroir de src/lib/cosinus.ts) pour le
// seed et le script d'embeddings. Déterministe, dimension 256.
function pseudoEmbedding(text, dim = 256) {
  const vec = new Array(dim).fill(0);
  const normalized = String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  const tokens = normalized.match(/[a-z0-9]+/g) || [];
  for (const tok of tokens) {
    let h = 2166136261;
    for (let i = 0; i < tok.length; i++) {
      h ^= tok.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const idx = Math.abs(h) % dim;
    vec[idx] += 1;
    const idx2 = Math.abs(Math.imul(h, 2654435761)) % dim;
    vec[idx2] += 0.5;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

module.exports = { pseudoEmbedding };
