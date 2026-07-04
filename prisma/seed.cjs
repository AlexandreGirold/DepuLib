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
  await prisma.creneau.deleteMany();
  await prisma.contribution.deleteMany();
  await prisma.commentaire.deleteMany();
  await prisma.amendement.deleteMany();
  await prisma.dossier.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organisation.deleteMany();
}

// N-ième occurrence d'un jour de semaine (0=dimanche..6=samedi) dans un mois
// donné, ou null si ce mois ne compte pas n occurrences de ce jour.
function niemeJourDuMois(annee, mois, jourSemaine, n) {
  const premier = new Date(annee, mois, 1);
  const jour = 1 + ((jourSemaine - premier.getDay() + 7) % 7) + (n - 1) * 7;
  const date = new Date(annee, mois, jour);
  return date.getMonth() === mois ? date : null;
}

// Créneaux de démo : permanence de 14h à 17h (3h, par tranches d'une heure —
// 14h/15h ouvertes aux citoyens, 16h aux représentants d'intérêts). En
// juillet : un jeudi sur deux (1er et 3e jeudi du mois). En septembre : une
// seule journée de permanence (1er jeudi du mois).
function creneauxDuJour(deputeId, jour) {
  const maintenant = new Date();
  const slots = [];
  for (const heure of [14, 15, 16]) {
    const debut = new Date(jour);
    debut.setHours(heure, 0, 0, 0);
    if (debut.getTime() <= maintenant.getTime()) continue;
    const publicCible = heure === 16 ? "representant" : "citoyen";
    slots.push({ deputeId, debut, fin: new Date(debut.getTime() + 60 * 60 * 1000), publicCible });
  }
  return slots;
}

function genererCreneaux(deputeId) {
  const annee = new Date().getFullYear();
  const creneaux = [];

  for (const n of [1, 3]) {
    const jour = niemeJourDuMois(annee, 6 /* juillet */, 4 /* jeudi */, n);
    if (jour) creneaux.push(...creneauxDuJour(deputeId, jour));
  }

  const jourSeptembre = niemeJourDuMois(annee, 8 /* septembre */, 4 /* jeudi */, 1);
  if (jourSeptembre) creneaux.push(...creneauxDuJour(deputeId, jourSeptembre));

  return creneaux;
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

  // --- Comptes de démonstration citoyens / représentant ---
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
  console.log("[seed] 3 comptes fictifs créés (citoyens + représentant)");

  // --- Députés réels (open data Assemblée nationale, figés dans seed/deputes.json) ---
  // DEPUTE_DEMO_SLUG sert de compte de démonstration connectable sur /connexion
  // (F6) : il faut un vrai identifiant de député pour pouvoir tester de bout en
  // bout — un citoyen ou un représentant envoie un RDV à un vrai député choisi
  // dans la liste, puis on se connecte sur son compte pour voir ce RDV
  // apparaître. Les autres députés réels ne sont que des fiches (nom, photo,
  // circonscription publics) : aucun avis ni décision fabriqués ne leur est
  // associé, seules des disponibilités génériques.
  const DEPUTE_DEMO_SLUG = "alain-david";
  const COMMISSION_DEMO =
    "Commission des lois constitutionnelles, de la législation et de l'administration générale de la République";
  const deputesReels = readJson("deputes.json", []);
  const deputeUsers = [];
  for (const d of deputesReels) {
    const user = await prisma.user.create({
      data: {
        username: d.slug.replace(/-/g, "."),
        role: "depute",
        displayName: `${d.prenom} ${d.nom}`,
        civilite: d.civilite,
        photoUrl: d.photoUrl,
        departementNom: d.departementNom,
        numDepartement: d.numDepartement,
        circonscription: `${String(d.numDepartement).padStart(2, "0")}-${String(d.numCirco).padStart(2, "0")}`,
        commission: d.slug === DEPUTE_DEMO_SLUG ? COMMISSION_DEMO : null
      }
    });
    deputeUsers.push(user);
  }
  const deputeDemo = deputeUsers.find((u) => u.username === DEPUTE_DEMO_SLUG.replace(/-/g, "."));
  if (!deputeDemo) {
    throw new Error(`Député de démo introuvable dans seed/deputes.json (slug ${DEPUTE_DEMO_SLUG})`);
  }
  console.log(
    `[seed] ${deputesReels.length} députés réels importés (open data) — compte démo connectable : ${deputeDemo.username}`
  );

  const paul = await prisma.user.create({
    data: {
      username: "paul.martin",
      role: "collaborateur",
      displayName: "Paul Martin",
      deputeId: deputeDemo.id,
      commission: COMMISSION_DEMO
    }
  });
  const usersByUsername = {
    "paul.martin": paul,
    "hugo.citoyen": hugo,
    "lea.citoyenne": lea,
    "jean.lobby": jean
  };

  // --- Créneaux de disponibilité (générés, aucune donnée réelle d'agenda n'existe) ---
  const tousLesCreneaux = deputeUsers.flatMap((u) => genererCreneaux(u.id));
  await prisma.creneau.createMany({ data: tousLesCreneaux });
  console.log(`[seed] ${tousLesCreneaux.length} créneaux générés pour ${deputeUsers.length} députés`);

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
        deputeId: deputeDemo.id,
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
