// npm run export:resumes — fige le contenu généré par l'IA (résumés de dossiers
// et d'amendements, synthèses) + les embeddings bge-m3 dans des fichiers JSON
// versionnés (seed/resumes.json, seed/embeddings.json). Ainsi un clone du dépôt
// retrouve EXACTEMENT le même contenu instantanément, sans clé API ni appel LLM :
// il suffit de `npm run seed` (qui recharge ces caches).
require("../scripts/loadenv.cjs").loadEnv();
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const SEED_DIR = path.join(__dirname, "..", "seed");

function parse(v) {
  if (v == null) return null;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

async function main() {
  const dossiers = await prisma.dossier.findMany({
    include: { amendements: true }
  });

  const resumes = { dossiers: {}, amendements: {} };
  const embeddings = {};
  let nd = 0,
    ns = 0,
    na = 0,
    ne = 0;

  for (const d of dossiers) {
    if (d.resumeIA || d.syntheseIA) {
      resumes.dossiers[d.id] = {
        resumeIA: d.resumeIA || null,
        sources: parse(d.sources) || [],
        syntheseIA: d.syntheseIA || null
      };
      if (d.resumeIA) nd++;
      if (d.syntheseIA) ns++;
    }
    for (const a of d.amendements) {
      const key = `${d.id}::${a.numero}`;
      if (a.resumeIA) {
        resumes.amendements[key] = {
          resumeIA: a.resumeIA,
          sources: parse(a.sources) || []
        };
        na++;
      }
      const emb = parse(a.embedding);
      // On ne fige que les embeddings « réels » (bge-m3, grande dimension),
      // pas les pseudo-embeddings de secours (256).
      if (Array.isArray(emb) && emb.length >= 512) {
        embeddings[key] = emb;
        ne++;
      }
    }
  }

  fs.writeFileSync(
    path.join(SEED_DIR, "resumes.json"),
    JSON.stringify(resumes, null, 1)
  );
  fs.writeFileSync(
    path.join(SEED_DIR, "embeddings.json"),
    JSON.stringify(embeddings)
  );

  const size = (f) =>
    (fs.statSync(path.join(SEED_DIR, f)).size / 1024 / 1024).toFixed(2);
  console.log(
    `[export] résumés dossiers: ${nd}, synthèses: ${ns}, résumés amendements: ${na}, embeddings: ${ne}`
  );
  console.log(
    `[export] seed/resumes.json (${size("resumes.json")} Mo) + seed/embeddings.json (${size("embeddings.json")} Mo) ✅`
  );
}

main()
  .catch((e) => {
    console.error("[export] Échec :", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
