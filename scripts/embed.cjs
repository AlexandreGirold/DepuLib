// npm run embed — calcule et stocke l'embedding bge-m3 de chaque amendement.
// En cas d'absence de clé ou d'échec API : embedding pseudo-aléatoire déterministe
// (hash du texte) pour que le pipeline de match reste testable.
require("../scripts/loadenv.cjs").loadEnv();
const { PrismaClient } = require("@prisma/client");
const { pseudoEmbedding } = require("./pseudoEmbedding.cjs");

const prisma = new PrismaClient();

const BASE_URL =
  process.env.CLOUDTEMPLE_LLMAAS_BASE_URL || "https://api.ai.cloud-temple.com/v1";
const API_KEY = process.env.CLOUDTEMPLE_LLMAAS_API_KEY || "";
const MODEL_EMBED = process.env.LLM_MODEL_EMBED || "bge-m3:567m";
const TIMEOUT = Number(process.env.LLM_TIMEOUT_MS || 20000);

async function embedReal(texts) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(`${BASE_URL}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`
      },
      body: JSON.stringify({ model: MODEL_EMBED, input: texts }),
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const vectors = (data.data || []).map((d) => d.embedding);
    if (vectors.length !== texts.length || vectors.some((v) => !v)) {
      throw new Error("réponse embeddings incomplète");
    }
    return vectors;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const amendements = await prisma.amendement.findMany();
  console.log(`[embed] ${amendements.length} amendements à traiter`);
  let useReal = API_KEY.trim() !== "";
  let ok = 0;
  let pseudo = 0;

  // Traite par lots de 16
  const BATCH = 16;
  for (let i = 0; i < amendements.length; i += BATCH) {
    const batch = amendements.slice(i, i + BATCH);
    const texts = batch.map((a) => `${a.dispositif} ${a.exposeSommaire}`);
    let vectors = null;
    if (useReal) {
      try {
        vectors = await embedReal(texts);
      } catch (e) {
        console.warn(`[embed] Échec API (${e.message}) → bascule pseudo-embeddings`);
        useReal = false;
      }
    }
    if (!vectors) {
      vectors = texts.map((t) => pseudoEmbedding(t));
      pseudo += batch.length;
    } else {
      ok += batch.length;
    }
    for (let j = 0; j < batch.length; j++) {
      await prisma.amendement.update({
        where: { id: batch[j].id },
        data: { embedding: JSON.stringify(vectors[j]) }
      });
    }
    console.log(`[embed] ${Math.min(i + BATCH, amendements.length)}/${amendements.length}`);
  }

  const nulls = await prisma.amendement.count({ where: { embedding: null } });
  console.log(`[embed] Terminé — réels: ${ok}, pseudo: ${pseudo}, embeddings nuls restants: ${nulls}`);
}

main()
  .catch((e) => {
    console.error("[embed] Échec :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
