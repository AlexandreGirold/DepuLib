// npm run parse-actus — parse les pages « ce qui change » (info.gouv.fr)
// téléchargées manuellement dans seed/actus/YYYY_MM.html, en extrait chaque
// mesure de façon DÉTERMINISTE (titre / contenu / liens officiels / URL source /
// thématique / résumé), puis écrit le résultat consolidé dans seed/actus.json
// (source de vérité, versionnée), que `npm run seed-actus` charge en base.
//
// Pourquoi 100 % déterministe (pas de LLM) :
//   - Extraction : les pages sont du HTML DSFR sémantique et propre (une mesure =
//     un <h2> suivi de ses <p>) → parsing fiable, aucune hallucination.
//   - Classification : les mesures « ce qui change » correspondent quasi mot pour
//     mot aux exemples des 6 thématiques du cahier des charges → un classifieur
//     par mots-clés est plus fiable ET reproductible que le LLM (qui, testé sur
//     mistral-small4, classait de façon erratique et non reproductible d'un run à
//     l'autre — ex. « leasing social »/« gaz »/« carburant » rangés à tort dans
//     « Administration »).
//   - Résumé : première phrase du texte extrait → reproductible, zéro invention.
// Le site info.gouv.fr est de toute façon protégé par Cloudflare (challenge
// anti-bot) : les pages sont fournies hors-ligne dans seed/actus/.
//
// ⚠️ TOPICS dupliqué de src/lib/actus.ts (script CJS, pas d'import TS).
const fs = require("node:fs");
const path = require("node:path");

const ACTUS_DIR = path.join(__dirname, "..", "seed", "actus");
const OUT_FILE = path.join(__dirname, "..", "seed", "actus.json");

// ---- thématiques (dupliqué de src/lib/actus.ts) -----------------------------
const TOPIC_FALLBACK = "Administration et Vie civique";

// Mots-clés par thématique, dérivés des exemples du cahier des charges. Ordre =
// priorité en cas d'égalité de score. Une occurrence dans le TITRE pèse plus
// qu'une occurrence dans le corps (voir classify()).
const TOPIC_MATCHERS = [
  ["Énergie et Logement", ["chèque énergie", "prix repère", "gaz", "dpe", "rénovation énergétique", "passoire thermique", "logement", "électricité", "chauffage"]],
  ["Transports et Mobilité", ["leasing", "véhicule", "voiture électrique", "électrique", "carburant", "carte grise", "mobilité", "bonus écologique"]],
  ["Travail et Économie", ["smic", "salaire minimum", "code des douanes", "douane", "cotisation", "salarié"]],
  ["Santé et Cohésion sociale", ["congé", "naissance", "maternité", "prime d'activité", "aide sociale", "allocation", "caf", "soins"]],
  ["Commerce et Pouvoir d'achat", ["solde", "étiquet", "alimentaire", "petit-déjeuner", "repas", "étudiant", "colis", "importé", "consommateur"]],
  ["Administration et Vie civique", ["élection", "déclaration des dons", "vacances scolaires", "vacances", "heure d'été", "calendrier scolaire", "don"]]
];

// ---- extraction déterministe HTML -------------------------------------------
function decodeEntities(s) {
  return (s || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&rsquo;|&apos;/gi, "’")
    .replace(/&laquo;/gi, "«")
    .replace(/&raquo;/gi, "»")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&hellip;/gi, "…")
    .replace(/&eacute;/gi, "é")
    .replace(/&egrave;/gi, "è")
    .replace(/&agrave;/gi, "à")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&[a-z]+;/gi, " ");
}

function textOf(html) {
  return decodeEntities((html || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function periodeFromFilename(name) {
  const m = /^(\d{4})_(\d{2})\.html$/i.exec(name);
  return m ? `${m[1]}-${m[2]}` : null;
}

// Un lien est « officiel utile » s'il n'est ni la page listing « ce qui change »,
// ni un partage réseau social.
function keepLink(url) {
  if (!/^https?:\/\//i.test(url)) return false;
  if (/\/toute-l-actualite\/ce-qui-change/i.test(url)) return false;
  if (/facebook|twitter|x\.com|linkedin|whatsapp|mailto:/i.test(url)) return false;
  return true;
}

/**
 * Extrait les mesures d'une page « ce qui change ». Chaque mesure = un <h2> du
 * corps d'article (entre le <h1> et « Partager la page »), suivi de ses <p>/<h3>.
 */
function parseHtmlFile(filePath) {
  const name = path.basename(filePath);
  const periode = periodeFromFilename(name);
  if (!periode) return [];
  const html = fs.readFileSync(filePath, "utf8");

  const sourceUrl =
    (html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i) ||
      html.match(/property="og:url"[^>]+content="([^"]+)"/i) ||
      [])[1] || "";

  const a = html.indexOf("</h1>");
  const b = html.indexOf("Partager la page");
  if (a === -1) return [];
  const body = html.slice(a, b === -1 ? undefined : b);

  const parts = body.split(/(?=<h2[^>]*>)/i).filter((s) => /<h2[^>]*>/i.test(s));
  const measures = [];
  for (const part of parts) {
    const titre = textOf((part.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) || [])[1] || "");
    if (!titre) continue;
    const after = part.replace(/<h2[\s\S]*?<\/h2>/i, "");

    const paras = [...after.matchAll(/<(p|h3)[^>]*>([\s\S]*?)<\/\1>/gi)]
      .map((x) => textOf(x[2]))
      .filter((t) => t.length > 0);
    const contenu = paras.join("\n").trim();
    if (!contenu) continue;

    const seen = new Set();
    const liens = [];
    for (const x of after.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const url = x[1];
      if (!keepLink(url) || seen.has(url)) continue;
      seen.add(url);
      liens.push({ url, label: textOf(x[2]) || "Source officielle" });
    }

    measures.push({ periode, sourceUrl, titre, contenu, liens });
  }
  return measures;
}

// ---- classification + résumé déterministes ----------------------------------
function classify(titre, contenu) {
  const t = titre.toLowerCase();
  const c = contenu.toLowerCase();
  let best = TOPIC_FALLBACK;
  let bestScore = 0;
  for (const [topic, words] of TOPIC_MATCHERS) {
    let score = 0;
    for (const w of words) {
      if (t.includes(w)) score += 3; // un mot-clé dans le titre est fort
      if (c.includes(w)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = topic;
    }
  }
  return best;
}

function firstSentence(text) {
  const s = (text || "").replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  const m = s.match(/^.*?[.!?](\s|$)/);
  let out = (m ? m[0] : s).trim();
  if (out.length > 260) out = out.slice(0, 257).replace(/\s+\S*$/, "") + "…";
  return out;
}

// ---- main -------------------------------------------------------------------
function main() {
  const files = fs
    .readdirSync(ACTUS_DIR)
    .filter((f) => /^\d{4}_\d{2}\.html$/i.test(f))
    .sort();
  if (files.length === 0) {
    console.error(`[parse-actus] Aucune page dans ${ACTUS_DIR} (attendu: YYYY_MM.html)`);
    process.exit(1);
  }
  console.log(`[parse-actus] ${files.length} page(s) à parser`);

  const records = [];
  for (const file of files) {
    const measures = parseHtmlFile(path.join(ACTUS_DIR, file));
    console.log(`[parse-actus] ${file} → ${measures.length} mesure(s)`);
    for (const m of measures) {
      records.push({
        periode: m.periode,
        topic: classify(m.titre, m.contenu),
        titre: m.titre,
        contenu: m.contenu,
        resume: firstSentence(m.contenu),
        liens: m.liens,
        sourceUrl: m.sourceUrl
      });
    }
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(records, null, 2) + "\n", "utf8");
  console.log(`[parse-actus] Terminé — ${records.length} actualité(s) écrites dans seed/actus.json`);
}

main();
