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
// Matching : par `numeroLong` + préfixe du dispositif (unique et fiable, même
// quand plusieurs amendements partagent le même numéro sur des textes différents).
//
// Usage :
//   node scripts/fix-amendements-opendata.cjs --dry   # rapport, n'écrit rien
//   node scripts/fix-amendements-opendata.cjs         # applique aux JSON du seed

const fs = require("fs");
const path = require("path");
const https = require("https");

const DRY = process.argv.includes("--dry");
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

function findMatch(seedAmdt, pool) {
  const sameNum = pool.filter((r) => r.numeroLong === seedAmdt.numero);
  if (sameNum.length === 0) return null;
  if (sameNum.length === 1) return sameNum[0];
  const disp = norm(seedAmdt.dispositif).slice(0, 80);
  const byDisp = sameNum.filter((r) => disp.length > 10 && norm(r.dispositif).startsWith(disp));
  if (byDisp.length === 1) return byDisp[0];
  // Dernier recours : préfixe d'exposé sommaire
  const exp = norm(seedAmdt.exposeSommaire).slice(0, 80);
  const byExp = sameNum.filter((r) => exp.length > 10 && norm(r.exposeSommaire).startsWith(exp));
  if (byExp.length === 1) return byExp[0];
  return null;
}

// Certains dossiers comptent plusieurs milliers d'amendements. On pagine et on
// tente d'apparier au fur et à mesure : dès que tous les amendements du seed
// sont trouvés, on s'arrête (arrêt anticipé). Si une page échoue durablement,
// on s'arrête proprement avec ce qu'on a (tolérance aux pannes réseau).
async function matchDossier(refUid, seedAmdts) {
  const found = new Map(); // seedAmdt -> real
  const pool = [];
  let page = 1;
  for (;;) {
    const url = `${API}?dossierRefUid=${encodeURIComponent(refUid)}&perPage=${PER_PAGE}&page=${page}`;
    let data;
    try {
      ({ data } = await getJson(url));
    } catch (e) {
      // page en échec : on renvoie les correspondances déjà trouvées
      return { found, partial: true, reason: e.message };
    }
    if (!data || data.length === 0) break;
    pool.push(...data);
    for (const a of seedAmdts) {
      if (found.has(a)) continue;
      const m = findMatch(a, pool);
      if (m) found.set(a, m);
    }
    if (found.size === seedAmdts.length) break; // tout trouvé → stop
    if (data.length < PER_PAGE) break; // dernière page
    page += 1;
    await sleep(200); // politesse entre pages
  }
  return { found, partial: false };
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
        // Aucune correspondance : on évite un lien cassé en pointant vers la
        // page officielle du dossier (réelle) plutôt qu'une URL d'amendement
        // fabriquée qui n'existe pas.
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

  console.log("\n==== BILAN ====");
  console.log(`Amendements totaux : ${totAmdt}`);
  console.log(`Rattachés à l'open data : ${totMatched}`);
  console.log(`URLs corrigées : ${totFixedUrl}`);
  console.log(`Sorts renseignés : ${totFixedSort}`);
  if (problems.length) {
    console.log(`\n${problems.length} problème(s) :`);
    for (const p of problems) console.log("  - " + p);
  } else {
    console.log("Aucun problème : tous les amendements rattachés ✅");
  }
  if (DRY) console.log("\n(dry-run — aucun fichier modifié)");
}

main().catch((e) => {
  console.error("Échec :", e);
  process.exit(1);
});
