// Répare les sources d'amendements des dossiers de démo (seed/dossiers/*.json)
// en les raccrochant aux VRAIS amendements de l'open data (API tricoteuses).
//
// Pourquoi : les `sourceUrl` du seed ont été construites à la main avec des
// numéros de texte erronés → les liens « source officielle » pointaient vers des
// amendements inexistants. On remplace chaque `sourceUrl` par l'URL canonique
// de l'AN dérivée de l'`uid` open data (`/dyn/17/amendements/{uid}`), qui
// redirige toujours vers la bonne page. On en profite pour renseigner le `sort`
// réel (Adopté / Rejeté / Tombé / Retiré…) quand il manque.
//
// Matching : par `numeroLong` + préfixe du dispositif, en privilégiant la
// version `canonique` en cas de doublon (rectifications). Fiable même quand
// plusieurs amendements partagent le même numéro sur des textes différents.
//
// Réaligne aussi les sources figées dans seed/resumes.json sur les URLs corrigées
// (sinon le BadgeSource afficherait encore un lien cassé).
//
// Sans correspondance (amendement absent de l'open data / API en panne), on
// replie sur l'URL officielle du dossier : jamais de lien cassé, au pire moins
// précis. Le script est idempotent et reprend en plusieurs passes (l'API
// tricoteuses rate-limite sous charge : 502/503).
//
// Après exécution : relancer `npm run seed` pour propager les corrections en BDD.
//
// Usage :
//   node scripts/fix-amendements-opendata.cjs --dry     # rapport, n'écrit rien
//   node scripts/fix-amendements-opendata.cjs           # applique (saute les déjà corrigés)
//   node scripts/fix-amendements-opendata.cjs --force   # retraite tous les dossiers

const fs = require("fs");
const path = require("path");
const https = require("https");

const DRY = process.argv.includes("--dry");
// Par défaut on saute les dossiers déjà corrigés (reprise en plusieurs passes).
// Utiliser --force pour tout retraiter.
const SKIP_FIXED = !DRY && !process.argv.includes("--force");
const DOSSIERS_DIR = path.join(__dirname, "..", "seed", "dossiers");
const API = "https://parlement.tricoteuses.fr/amendements";
const AN_BASE = "https://www.assemblee-nationale.fr/dyn/17/amendements";

function getJsonOnce(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Accept: "application/json" } }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(30000, () => req.destroy(new Error("timeout")));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// L'API tricoteuses renvoie fréquemment des 502/503 sous charge. Retry généreux
// avec backoff exponentiel (jusqu'à ~30 s cumulés) pour laisser passer les
// coups de mou transitoires.
async function getJson(url) {
  let last;
  for (let i = 0; i < 4; i++) {
    try {
      return await getJsonOnce(url);
    } catch (e) {
      last = e;
      await sleep(Math.min(4000, 600 * 2 ** i));
    }
  }
  throw last;
}

function norm(s) {
  if (!s) return "";
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^0-9a-z]+/g, " ")
    .trim();
}

// id dossier « an-dlr5l17n50444 » -> refUid open data « DLR5L17N50444 »
function dossierRefUid(id) {
  return id.replace(/^an-/, "").toUpperCase();
}

const PER_PAGE = 500;

// Départage une liste de candidats : l'open data contient parfois des doublons
// (versions rectifiées, ré-enregistrements). On privilégie l'amendement marqué
// `canonique`. Renvoie l'unique candidat retenu, ou null si toujours ambigu.
function pickOne(cands) {
  if (cands.length === 1) return cands[0];
  const canon = cands.filter((r) => r.canonique === true || r.canonique === "true");
  if (canon.length === 1) return canon[0];
  return null;
}

function findMatch(seedAmdt, pool) {
  const sameNum = pool.filter((r) => r.numeroLong === seedAmdt.numero);
  if (sameNum.length === 0) return null;
  if (sameNum.length === 1) return sameNum[0];
  const disp = norm(seedAmdt.dispositif).slice(0, 80);
  const byDisp = sameNum.filter((r) => disp.length > 10 && norm(r.dispositif).startsWith(disp));
  const byDispOne = pickOne(byDisp);
  if (byDispOne) return byDispOne;
  // Dernier recours : préfixe d'exposé sommaire
  const exp = norm(seedAmdt.exposeSommaire).slice(0, 80);
  const byExp = sameNum.filter((r) => exp.length > 10 && norm(r.exposeSommaire).startsWith(exp));
  return pickOne(byExp);
}

// Certains dossiers comptent plusieurs milliers d'amendements. On récupère la
// liste COMPLÈTE d'abord, puis on apparie : indispensable, car un même numéro
// (« 1 », « 5 »…) peut désigner plusieurs amendements sur des textes différents
// (commission vs séance) — n'apparier qu'après pagination complète évite de
// s'accrocher au mauvais candidat vu en premier. Si une page échoue durablement
// (502/503), on apparie sur ce qu'on a déjà chargé (tolérance aux pannes).
async function matchDossier(refUid, seedAmdts) {
  const pool = [];
  let page = 1;
  let partial = false;
  let reason;
  for (;;) {
    const url = `${API}?dossierRefUid=${encodeURIComponent(refUid)}&perPage=${PER_PAGE}&page=${page}`;
    let data;
    try {
      ({ data } = await getJson(url));
    } catch (e) {
      partial = true;
      reason = e.message;
      break;
    }
    if (!data || data.length === 0) break;
    pool.push(...data);
    if (data.length < PER_PAGE) break; // dernière page
    page += 1;
    await sleep(200); // politesse entre pages
  }
  const found = new Map(); // seedAmdt -> real
  for (const a of seedAmdts) {
    const m = findMatch(a, pool);
    if (m) found.set(a, m);
  }
  return { found, partial, reason };
}

async function main() {
  const files = fs.readdirSync(DOSSIERS_DIR).filter((f) => f.endsWith(".json"));
  let totAmdt = 0,
    totMatched = 0,
    totFixedUrl = 0,
    totFixedSort = 0;
  const problems = [];

  for (const file of files) {
    const full = path.join(DOSSIERS_DIR, file);
    const dossier = JSON.parse(fs.readFileSync(full, "utf8"));
    const amdts = dossier.amendements || [];
    if (amdts.length === 0) continue;

    // Résumable : un dossier dont tous les amendements pointent déjà vers une URL
    // canonique open data (…/amendements/AM…) est considéré traité. Permet de
    // relancer le script en plusieurs passes (l'API rate-limite sous charge).
    if (SKIP_FIXED && amdts.every((a) => (a.sourceUrl || "").startsWith(`${AN_BASE}/AM`))) {
      process.stdout.write(`${dossier.id}: déjà corrigé — ignoré\n`);
      continue;
    }

    let found;
    try {
      const res = await matchDossier(dossierRefUid(dossier.id), amdts);
      found = res.found;
      if (res.partial) problems.push(`${file}: pagination interrompue (${res.reason}) — appariés partiels`);
    } catch (e) {
      problems.push(`${file}: échec open data (${e.message})`);
      found = new Map();
    }

    let changed = false;
    for (const a of amdts) {
      totAmdt += 1;
      const m = found.get(a);
      if (!m) {
        // Aucune correspondance CETTE passe. Protection anti-régression : si
        // l'URL est déjà canonique (fixée lors d'une passe précédente), on la
        // conserve — un 502 transitoire ne doit pas casser une bonne URL.
        if ((a.sourceUrl || "").startsWith(`${AN_BASE}/AM`)) continue;
        // Sinon on évite un lien cassé en pointant vers la page officielle du
        // dossier (réelle) plutôt qu'une URL d'amendement fabriquée inexistante.
        problems.push(`${file}: amendement n°${a.numero} sans correspondance → repli sur l'URL du dossier`);
        if (a.sourceUrl !== dossier.sourceUrl) {
          a.sourceUrl = dossier.sourceUrl;
          changed = true;
        }
        continue;
      }
      totMatched += 1;
      const canon = `${AN_BASE}/${m.uid}`;
      if (a.sourceUrl !== canon) {
        a.sourceUrl = canon;
        totFixedUrl += 1;
        changed = true;
      }
      if ((!a.sort || a.sort === null) && m.sortAmendement) {
        a.sort = m.sortAmendement;
        totFixedSort += 1;
        changed = true;
      }
    }

    if (changed && !DRY) {
      fs.writeFileSync(full, JSON.stringify(dossier, null, 2) + "\n", "utf8");
    }
    process.stdout.write(
      `${DRY ? "[dry] " : ""}${dossier.id}: ${amdts.length} amdt` +
        ` (${found.size} appariés)${changed ? " maj" : ""}\n`
    );
    await sleep(300); // politesse entre dossiers
  }

  // --- Réaligne le cache IA figé (seed/resumes.json) sur les URLs corrigées ---
  // Les résumés d'amendements y sont figés avec leurs `sources` : si celles-ci
  // pointent encore vers les anciennes URLs fabriquées, le BadgeSource afficherait
  // un lien cassé même après correction des dossiers. On réécrit chaque source
  // d'amendement vers l'URL désormais valide (pas de réseau nécessaire).
  const nSources = DRY ? 0 : syncResumesCache();

  console.log("\n==== BILAN ====");
  console.log(`Amendements totaux : ${totAmdt}`);
  console.log(`Rattachés à l'open data : ${totMatched}`);
  console.log(`URLs corrigées : ${totFixedUrl}`);
  console.log(`Sorts renseignés : ${totFixedSort}`);
  if (!DRY) console.log(`Sources du cache figé (resumes.json) réalignées : ${nSources}`);
  if (problems.length) {
    console.log(`\n${problems.length} problème(s) :`);
    for (const p of problems) console.log("  - " + p);
  } else {
    console.log("Aucun problème : tous les amendements rattachés ✅");
  }
  if (DRY) console.log("\n(dry-run — aucun fichier modifié)");
}

// Réécrit les URLs de source d'amendement dans seed/resumes.json pour qu'elles
// correspondent aux sourceUrl (corrigés) des dossiers. Retourne le nombre de
// sources réalignées. Ne touche pas au texte des résumés.
function syncResumesCache() {
  const resumesPath = path.join(__dirname, "..", "seed", "resumes.json");
  if (!fs.existsSync(resumesPath)) return 0;
  const resumes = JSON.parse(fs.readFileSync(resumesPath, "utf8"));
  if (!resumes.amendements) return 0;

  // Map { "dossierId::numero" -> sourceUrl corrigé } depuis les dossiers.
  const urlByKey = new Map();
  const titreByKey = new Map();
  const files = fs.readdirSync(DOSSIERS_DIR).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const dossier = JSON.parse(fs.readFileSync(path.join(DOSSIERS_DIR, file), "utf8"));
    for (const a of dossier.amendements || []) {
      const key = `${dossier.id}::${a.numero}`;
      urlByKey.set(key, a.sourceUrl);
      titreByKey.set(key, `Amendement n°${a.numero}`);
    }
  }

  let n = 0;
  for (const [key, entry] of Object.entries(resumes.amendements)) {
    const url = urlByKey.get(key);
    if (!url) continue;
    // Une seule source pertinente : l'amendement lui-même, à l'URL corrigée.
    const before = JSON.stringify(entry.sources || []);
    entry.sources = [{ url, titre: titreByKey.get(key) }];
    if (JSON.stringify(entry.sources) !== before) n += 1;
  }
  fs.writeFileSync(resumesPath, JSON.stringify(resumes, null, 1));
  return n;
}

main().catch((e) => {
  console.error("Échec :", e);
  process.exit(1);
});
