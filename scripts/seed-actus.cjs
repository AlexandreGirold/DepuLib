// npm run seed-actus — charge seed/actus.json (produit par `npm run parse-actus`)
// dans la table Actualite. Étape déterministe : aucun LLM, aucun réseau.
// Dédup idempotente par `cle` = hash(sourceUrl + "|" + titre) : ré-exécutable sans
// créer de doublons.
require("../scripts/loadenv.cjs").loadEnv();
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const IN_FILE = path.join(__dirname, "..", "seed", "actus.json");

function cleFor(sourceUrl, titre) {
  return crypto.createHash("sha1").update(`${sourceUrl}|${titre}`).digest("hex");
}

async function main() {
  if (!fs.existsSync(IN_FILE)) {
    console.error(`[seed-actus] ${IN_FILE} introuvable — lancez d'abord \`npm run parse-actus\`.`);
    process.exit(1);
  }
  const records = JSON.parse(fs.readFileSync(IN_FILE, "utf8"));
  if (!Array.isArray(records)) {
    console.error("[seed-actus] seed/actus.json invalide (tableau attendu).");
    process.exit(1);
  }
  console.log(`[seed-actus] ${records.length} actualité(s) à charger`);

  let created = 0;
  let skipped = 0;
  for (const r of records) {
    if (!r || !r.titre || !r.periode || !r.topic) {
      skipped += 1;
      continue;
    }
    const cle = cleFor(r.sourceUrl || "", r.titre);
    const existing = await prisma.actualite.findUnique({ where: { cle } });
    if (existing) {
      skipped += 1;
      continue;
    }
    await prisma.actualite.create({
      data: {
        cle,
        periode: r.periode,
        topic: r.topic,
        titre: r.titre,
        contenu: r.contenu || "",
        resume: r.resume || "",
        liens: JSON.stringify(Array.isArray(r.liens) ? r.liens : []),
        sourceUrl: r.sourceUrl || ""
      }
    });
    created += 1;
  }

  console.log(`[seed-actus] Terminé — créées: ${created}, ignorées (déjà en base): ${skipped}`);
}

main()
  .catch((e) => {
    console.error("[seed-actus] Échec :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
