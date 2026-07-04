// npm run warm — pré-génère et met en cache (BDD) les résumés IA de tous les
// dossiers et amendements qui n'en ont pas encore. À lancer après le seed +
// l'embed, quand on récupère de nouvelles lois : cliquer sur une loi devient
// alors instantané (le résumé est déjà en base).
//
// Autonome (comme embed.cjs) : n'a pas besoin du serveur Next. En l'absence de
// clé LLMaaS, retombe sur les résumés de secours déterministes.
require("../scripts/loadenv.cjs").loadEnv();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const BASE_URL =
  process.env.CLOUDTEMPLE_LLMAAS_BASE_URL || "https://api.ai.cloud-temple.com/v1";
const API_KEY = (process.env.CLOUDTEMPLE_LLMAAS_API_KEY || "").trim();
const MODEL_MAIN = process.env.LLM_MODEL_MAIN || "mistral-small4:119b";
const TIMEOUT = Number(process.env.LLM_TIMEOUT_MS || 20000);
const CONCURRENCY = 5;

const SYSTEM_PROMPT =
  "Tu es un assistant de l'application Dépulib. Réponds uniquement à partir des " +
  "textes fournis dans le contexte. Si l'information n'y figure pas, réponds " +
  'exactement "information non disponible dans les sources". Cite les passages ' +
  "utilisés. Tu ne donnes jamais d'opinion politique, tu ne recommandes jamais " +
  "de voter pour ou contre. Réponds uniquement en JSON valide, sans markdown.";

let mockMode = API_KEY === "";
let consecutiveFailures = 0;

async function chat(messages) {
  if (mockMode || consecutiveFailures >= 3) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL_MAIN,
        messages,
        max_tokens: 1200,
        temperature: 0.1,
        response_format: { type: "json_object" }
      }),
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    consecutiveFailures = 0;
    return data?.choices?.[0]?.message?.content ?? "";
  } catch (e) {
    consecutiveFailures += 1;
    if (consecutiveFailures >= 3) console.warn("[warm] LLMaaS indisponible → résumés de secours");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseJsonLoose(raw) {
  if (!raw) return null;
  let s = String(raw).trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const first = s.search(/[[{]/);
  if (first > 0) s = s.slice(first);
  const last = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (last >= 0) s = s.slice(0, last + 1);
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function validateSources(cands, allowed) {
  if (!Array.isArray(cands)) return [];
  const set = new Set(allowed.map((u) => (u || "").trim().replace(/\/+$/, "").toLowerCase()));
  const out = [];
  const seen = new Set();
  for (const c of cands) {
    if (!c || typeof c !== "object") continue;
    const url = String(c.url || "");
    const key = url.trim().replace(/\/+$/, "").toLowerCase();
    if (!url || !set.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({ url, titre: String(c.titre || c.title || "Source officielle"), extrait: c.extrait ? String(c.extrait) : undefined });
  }
  return out;
}

async function mapLimit(items, limit, fn) {
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

async function warmDossier(d) {
  if (d.resumeIA) return false;
  const raw = await chat([
    { role: "system", content: SYSTEM_PROMPT + '\nFormat : {"resume": string (5 phrases max), "points_cles": string[] (3 à 5), "sources": [{"url","titre","extrait"}]}.' },
    {
      role: "user",
      content:
        `Dossier législatif : « ${d.titre} ».\nURL officielle : ${d.sourceUrl}\n\n` +
        `Exposé des motifs :\n${d.expose}\n\nRédige un résumé neutre et cite l'URL officielle en source.`
    }
  ]);
  const parsed = parseJsonLoose(raw);
  let json = d.json ? JSON.parse(d.json) : {};
  if (parsed && typeof parsed.resume === "string") {
    const sources = validateSources(parsed.sources, [d.sourceUrl]);
    await prisma.dossier.update({
      where: { id: d.id },
      data: {
        resumeIA: JSON.stringify({
          resume: parsed.resume,
          points_cles: Array.isArray(parsed.points_cles) ? parsed.points_cles.map(String).slice(0, 5) : []
        }),
        sources: JSON.stringify(sources.length ? sources : [{ url: d.sourceUrl, titre: "Dossier législatif — Assemblée nationale" }])
      }
    });
  } else {
    // Fallback déterministe
    await prisma.dossier.update({
      where: { id: d.id },
      data: {
        resumeIA: JSON.stringify({
          resume: json.resumeFallback || d.expose.slice(0, 400).replace(/\s+\S*$/, "") + "…",
          points_cles: json.pointsClesFallback || []
        }),
        sources: JSON.stringify([{ url: d.sourceUrl, titre: "Dossier législatif — Assemblée nationale" }])
      }
    });
  }
  return true;
}

async function warmAmendement(a) {
  if (a.resumeIA) return false;
  const raw = await chat([
    { role: "system", content: SYSTEM_PROMPT + '\nFormat : {"resume": string (2 phrases max), "sources": [{"url","titre"}]}.' },
    {
      role: "user",
      content:
        `Amendement n°${a.numero} (${a.auteur}).\nURL : ${a.sourceUrl}\n\n` +
        `Dispositif : ${a.dispositif}\n\nExposé sommaire : ${a.exposeSommaire}\n\nRésume l'objet de cet amendement en langage clair.`
    }
  ]);
  const parsed = parseJsonLoose(raw);
  if (parsed && typeof parsed.resume === "string") {
    const sources = validateSources(parsed.sources, [a.sourceUrl]);
    await prisma.amendement.update({
      where: { id: a.id },
      data: { resumeIA: parsed.resume, sources: JSON.stringify(sources) }
    });
  } else {
    await prisma.amendement.update({
      where: { id: a.id },
      data: {
        resumeIA: a.exposeSommaire.slice(0, 200).replace(/\s+\S*$/, "") + "…",
        sources: JSON.stringify([{ url: a.sourceUrl, titre: `Amendement n°${a.numero}` }])
      }
    });
  }
  return true;
}

async function main() {
  if (mockMode) console.log("[warm] Aucune clé LLMaaS → résumés de secours déterministes");
  const dossiers = await prisma.dossier.findMany({ where: { resumeIA: null } });
  console.log(`[warm] ${dossiers.length} dossiers à résumer`);
  let nd = 0;
  await mapLimit(dossiers, CONCURRENCY, async (d) => {
    if (await warmDossier(d)) nd++;
    if (nd % 10 === 0 && nd) console.log(`[warm] dossiers ${nd}/${dossiers.length}`);
  });

  const amdts = await prisma.amendement.findMany({ where: { resumeIA: null } });
  console.log(`[warm] ${amdts.length} amendements à résumer`);
  let na = 0;
  await mapLimit(amdts, CONCURRENCY, async (a) => {
    if (await warmAmendement(a)) na++;
    if (na % 40 === 0 && na) console.log(`[warm] amendements ${na}/${amdts.length}`);
  });

  console.log(`[warm] Terminé — ${nd} dossiers + ${na} amendements résumés et mis en cache ✅`);
}

main()
  .catch((e) => {
    console.error("[warm] Échec :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
