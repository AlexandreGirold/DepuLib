// Seed statique de Dépulib. Charge les dossiers/amendements, les organisations
// HATVP, les 5 comptes de démonstration, les commentaires pré-écrits (dont 2
// flaggés), un RDV représentant→député et un feed pré-généré pour hugo.citoyen.
require("../scripts/loadenv.cjs").loadEnv();
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");
const { pseudoEmbedding } = require("../scripts/pseudoEmbedding.cjs");

const prisma = new PrismaClient();
const SEED_DIR = path.join(__dirname, "..", "seed");

function readJson(rel, fallback) {
  const p = path.join(SEED_DIR, rel);
  if (!fs.existsSync(p)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Fichier seed manquant : ${rel}`);
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function readDossiers() {
  const dir = path.join(SEED_DIR, "dossiers");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
  return files.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
}

// Caches IA figés (résumés/synthèses + embeddings réels). S'ils sont présents,
// le seed les recharge → un clone retrouve exactement le même contenu sans clé
// API ni appel LLM. Absents → génération à la volée par embed/warm.
const resumesCache = readJson("resumes.json", { dossiers: {}, amendements: {} });
const embeddingsCache = readJson("embeddings.json", {});

async function reset() {
  // Ordre de suppression : enfants avant parents.
  await prisma.upvoteComm.deleteMany();
  await prisma.document.deleteMany();
  await prisma.rdvDossier.deleteMany();
  await prisma.rendezVous.deleteMany();
  await prisma.contribution.deleteMany();
  await prisma.commentaire.deleteMany();
  await prisma.amendement.deleteMany();
  await prisma.dossier.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organisation.deleteMany();
}

async function main() {
  console.log("[seed] Réinitialisation…");
  await reset();

  // --- Organisations HATVP ---
  const hatvp = readJson("hatvp.json", []);
  const orgRecords = [];
  for (const o of hatvp) {
    const rec = await prisma.organisation.create({
      data: {
        nomHatvp: o.nomHatvp,
        numeroHatvp: o.numeroHatvp,
        secteur: o.secteur,
        description: o.description,
        lienHatvp: o.lienHatvp
      }
    });
    orgRecords.push(rec);
  }
  console.log(`[seed] ${orgRecords.length} organisations HATVP`);

  // --- Comptes de démonstration ---
  const marie = await prisma.user.create({
    data: {
      username: "marie.dupont",
      role: "depute",
      displayName: "Marie Dupont",
      circonscription: "75-03",
      commission: "Commission des lois constitutionnelles, de la législation et de l'administration générale de la République"
    }
  });
  const paul = await prisma.user.create({
    data: {
      username: "paul.martin",
      role: "collaborateur",
      displayName: "Paul Martin",
      deputeId: marie.id,
      commission: "Commission des lois constitutionnelles, de la législation et de l'administration générale de la République"
    }
  });
  const hugo = await prisma.user.create({
    data: {
      username: "hugo.citoyen",
      role: "citoyen",
      displayName: "Hugo Citoyen",
      circonscription: "93-07"
    }
  });
  const lea = await prisma.user.create({
    data: {
      username: "lea.citoyenne",
      role: "citoyen",
      displayName: "Léa Citoyenne",
      circonscription: "93-07"
    }
  });
  const jean = await prisma.user.create({
    data: {
      username: "jean.lobby",
      role: "representant",
      displayName: "Jean Lobbyiste",
      organisationId: orgRecords[0] ? orgRecords[0].id : null
    }
  });
  const usersByUsername = {
    "marie.dupont": marie,
    "paul.martin": paul,
    "hugo.citoyen": hugo,
    "lea.citoyenne": lea,
    "jean.lobby": jean
  };
  console.log("[seed] 5 comptes créés");

  // --- Dossiers + amendements ---
  const dossiers = readDossiers();
  const amdtByDossierNumero = {}; // dossierId -> { numero -> amendementId }
  for (const d of dossiers) {
    const dc = resumesCache.dossiers[d.id] || {};
    await prisma.dossier.create({
      data: {
        id: d.id,
        titre: d.titre,
        numero: d.numero,
        statut: d.statut,
        commission: d.commission,
        expose: d.expose,
        sourceUrl: d.sourceUrl,
        source: d.source || "donnees-demo",
        odj: !!d.odj,
        resumeIA: dc.resumeIA || null,
        syntheseIA: dc.syntheseIA || null,
        sources: dc.sources ? JSON.stringify(dc.sources) : null,
        json: JSON.stringify(d)
      }
    });
    amdtByDossierNumero[d.id] = {};
    for (const a of d.amendements || []) {
      const key = `${d.id}::${a.numero}`;
      const ac = resumesCache.amendements[key] || {};
      // Embedding : réel figé si disponible, sinon pseudo déterministe.
      const emb = embeddingsCache[key] || pseudoEmbedding(`${a.dispositif} ${a.exposeSommaire}`);
      const rec = await prisma.amendement.create({
        data: {
          dossierId: d.id,
          numero: a.numero,
          auteur: a.auteur,
          article: a.article || null,
          dispositif: a.dispositif,
          exposeSommaire: a.exposeSommaire,
          sort: a.sort || null,
          sourceUrl: a.sourceUrl,
          resumeIA: ac.resumeIA || null,
          sources: ac.sources ? JSON.stringify(ac.sources) : null,
          embedding: JSON.stringify(emb)
        }
      });
      amdtByDossierNumero[d.id][a.numero] = rec.id;
    }
    console.log(`[seed] Dossier ${d.id} (${(d.amendements || []).length} amendements)`);
  }

  // --- Commentaires pré-écrits ---
  const commentaires = readJson("commentaires.json", []);
  let flagCount = 0;
  for (const c of commentaires) {
    const user = usersByUsername[c.username];
    if (!user) continue;
    const amdtMap = amdtByDossierNumero[c.dossierId] || {};
    const amendementId = c.amendementNumero ? amdtMap[c.amendementNumero] || null : null;
    const created = await prisma.commentaire.create({
      data: {
        dossierId: c.dossierId,
        amendementId,
        userId: user.id,
        texte: c.texte,
        sentiment: typeof c.sentiment === "number" ? c.sentiment : 0,
        moderationFlag: c.moderationFlag || "ok",
        moderationMotif: c.moderationMotif || null,
        upvotes: typeof c.upvotes === "number" ? c.upvotes : 0
      }
    });
    if ((c.moderationFlag || "ok") !== "ok") flagCount++;
    // Incrémente les soutiens de l'amendement lié
    if (amendementId) {
      await prisma.amendement.update({
        where: { id: amendementId },
        data: { upvotes: { increment: 1 } }
      });
    }
  }
  console.log(`[seed] ${commentaires.length} commentaires (${flagCount} flaggés)`);

  // --- RDV représentant → député (F6) ---
  // Dossier vedette : protection des mineurs sur les réseaux sociaux (réel, ODJ).
  const dossierNum =
    dossiers.find((d) => d.id === "an-dlr5l17n53187") ||
    dossiers.find((d) => /r[eé]seaux sociaux/i.test(d.titre)) ||
    dossiers[0];
  if (dossierNum) {
    const rdv = await prisma.rendezVous.create({
      data: {
        deputeId: marie.id,
        demandeurId: jean.id,
        typeDemandeur: "representant",
        sujet:
          "Encadrement de la vérification d'âge sur les plateformes numériques : position de notre organisation",
        briefIA: JSON.stringify({
          contenu:
            "Rendez-vous demandé par un représentant d'intérêts du secteur numérique au sujet de la vérification d'âge et de la protection des mineurs en ligne. L'organisation souhaite exposer sa position sur les obligations des plateformes prévues par le dossier. Points d'attention : proportionnalité technique et protection des données personnelles.",
          sources: [{ url: dossierNum.sourceUrl, titre: dossierNum.titre }]
        }),
        sources: JSON.stringify([{ url: dossierNum.sourceUrl, titre: dossierNum.titre }]),
        date: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        statut: "demande",
        rdvDossiers: { create: [{ dossierId: dossierNum.id }] }
      }
    });
    console.log(`[seed] RDV seedé ${rdv.id}`);
  }

  console.log("[seed] Terminé ✅");
}

main()
  .catch((e) => {
    console.error("[seed] Échec :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
