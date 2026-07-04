import { chat, parseJsonLoose, MODELS } from "./llmaas";
import { validateSources, Source } from "./sources";
import { cosine } from "./cosinus";

/**
 * Pipeline IA — 6 fonctions (§8). Toutes retournent du JSON structuré,
 * toutes ont un fallback non-IA, toutes valident leurs sources contre le
 * contexte fourni (anti-hallucination).
 */

export const SYSTEM_PROMPT =
  "Tu es un assistant de l'application Dépulib. Réponds uniquement à partir des " +
  "textes fournis dans le contexte. Si l'information n'y figure pas, réponds " +
  'exactement "information non disponible dans les sources". Cite les passages ' +
  "utilisés. Tu ne donnes jamais d'opinion politique, tu ne recommandes jamais " +
  "de voter pour ou contre. Réponds uniquement en JSON valide, sans markdown.";

function sys(extra?: string) {
  return { role: "system" as const, content: SYSTEM_PROMPT + (extra ? "\n" + extra : "") };
}

// ---- 1. Résumé de dossier --------------------------------------------

export type ResumeDossierOut = {
  resume: string;
  points_cles: string[];
  sources: Source[];
};

export async function resumeDossier(dossier: {
  id: string;
  titre: string;
  expose: string;
  sourceUrl: string;
  resumeFallback?: string | null;
  pointsClesFallback?: string[] | null;
}): Promise<ResumeDossierOut> {
  const allowed = [dossier.sourceUrl];
  const raw = await chat(
    [
      sys(
        'Format attendu : {"resume": string (5 phrases max, neutre, factuel), ' +
          '"points_cles": string[] (3 à 5), "sources": [{"url","titre","extrait"}]}.'
      ),
      {
        role: "user",
        content:
          `Dossier législatif : « ${dossier.titre} ».\n` +
          `URL officielle : ${dossier.sourceUrl}\n\n` +
          `Exposé des motifs :\n${dossier.expose}\n\n` +
          "Rédige un résumé neutre et cite l'URL officielle en source."
      }
    ],
    { model: MODELS.main, json: true, mockKey: `resumeDossier:${dossier.id}` }
  );

  const parsed = parseJsonLoose<any>(raw);
  if (parsed && typeof parsed.resume === "string") {
    return {
      resume: parsed.resume,
      points_cles: Array.isArray(parsed.points_cles)
        ? parsed.points_cles.map(String).slice(0, 5)
        : [],
      sources: validateSources(parsed.sources, allowed)
    };
  }
  // Fallback : résumé pré-écrit du seed
  return {
    resume:
      dossier.resumeFallback ??
      dossier.expose.slice(0, 400).replace(/\s+\S*$/, "") + "…",
    points_cles: dossier.pointsClesFallback ?? [],
    sources: [
      { url: dossier.sourceUrl, titre: "Dossier législatif — Assemblée nationale" }
    ]
  };
}

// ---- 2. Résumé d'amendement ------------------------------------------

export type ResumeAmendementOut = { resume: string; sources: Source[] };

export async function resumeAmendement(amdt: {
  id: string;
  numero: string;
  auteur: string;
  dispositif: string;
  exposeSommaire: string;
  sourceUrl: string;
}): Promise<ResumeAmendementOut> {
  const allowed = [amdt.sourceUrl];
  const raw = await chat(
    [
      sys('Format : {"resume": string (2 phrases max), "sources": [{"url","titre"}]}.'),
      {
        role: "user",
        content:
          `Amendement n°${amdt.numero} (${amdt.auteur}).\n` +
          `URL : ${amdt.sourceUrl}\n\n` +
          `Dispositif : ${amdt.dispositif}\n\n` +
          `Exposé sommaire : ${amdt.exposeSommaire}\n\n` +
          "Résume l'objet de cet amendement en langage clair."
      }
    ],
    { model: MODELS.main, json: true, mockKey: `resumeAmendement:${amdt.id}` }
  );
  const parsed = parseJsonLoose<any>(raw);
  if (parsed && typeof parsed.resume === "string") {
    return {
      resume: parsed.resume,
      sources: validateSources(parsed.sources, allowed)
    };
  }
  // Fallback : 200 premiers caractères de l'exposé sommaire
  return {
    resume: amdt.exposeSommaire.slice(0, 200).replace(/\s+\S*$/, "") + "…",
    sources: [{ url: amdt.sourceUrl, titre: `Amendement n°${amdt.numero}` }]
  };
}

// ---- 3. Classification (sentiment + modération) ----------------------

export type ClassifOut = {
  sentiment: number; // -2..2
  flag: "ok" | "insultant" | "hors_sujet" | "propagande";
  motif?: string | null;
};

const FLAGS = ["ok", "insultant", "hors_sujet", "propagande"];

export async function classifieCommentaire(texte: string): Promise<ClassifOut> {
  const raw = await chat(
    [
      sys(
        "Analyse un commentaire citoyen sur un texte de loi. " +
          'Format : {"sentiment": entier de -2 (très défavorable) à 2 (très ' +
          'favorable), "flag": "ok"|"insultant"|"hors_sujet"|"propagande", ' +
          '"motif": string court si flag ≠ ok sinon null}.'
      ),
      { role: "user", content: `Commentaire : « ${texte} »` }
    ],
    { model: MODELS.fast, json: true, mockKey: `classif:${hashKey(texte)}` }
  );
  const parsed = parseJsonLoose<any>(raw);
  if (parsed && typeof parsed.sentiment === "number") {
    const flag = FLAGS.includes(parsed.flag) ? parsed.flag : "ok";
    return {
      sentiment: Math.max(-2, Math.min(2, Math.round(parsed.sentiment))),
      flag: flag as ClassifOut["flag"],
      motif: flag === "ok" ? null : parsed.motif ? String(parsed.motif) : "Signalé"
    };
  }
  // Fallback : sentiment neutre, non flaggé
  return { sentiment: 0, flag: "ok", motif: null };
}

// ---- 4. Match amendement (juge) --------------------------------------

export type MatchOut = {
  match: boolean;
  amendementId: string | null;
  justification: string;
  confiance: number;
  auto?: boolean; // correspondance sémantique automatique (fallback)
};

export async function matchAmendement(
  commentaire: string,
  top10: {
    id: string;
    numero: string;
    auteur: string;
    dispositif: string;
    exposeSommaire: string;
    score: number;
  }[]
): Promise<MatchOut> {
  if (top10.length === 0) {
    return { match: false, amendementId: null, justification: "", confiance: 0 };
  }
  const liste = top10
    .map(
      (a, i) =>
        `[${i}] id=${a.id} n°${a.numero} (${a.auteur}) : ${a.dispositif} — ${a.exposeSommaire}`
    )
    .join("\n");
  const raw = await chat(
    [
      sys(
        "Tu détermines si l'un des amendements proposés répond précisément à la " +
          "préoccupation exprimée dans le commentaire citoyen. Sois exigeant : ne " +
          "conclus à un match que si le lien est net. " +
          'Format : {"match": boolean, "amendementId": string|null (l\'id exact ' +
          'de l\'amendement retenu), "justification": string (1 phrase), ' +
          '"confiance": nombre entre 0 et 1}.'
      ),
      {
        role: "user",
        content:
          `Commentaire citoyen : « ${commentaire} »\n\n` +
          `Amendements candidats :\n${liste}`
      }
    ],
    { model: MODELS.main, json: true, mockKey: `match:${hashKey(commentaire)}` }
  );
  const parsed = parseJsonLoose<any>(raw);
  if (parsed && typeof parsed.confiance === "number") {
    const id =
      parsed.amendementId && top10.some((a) => a.id === parsed.amendementId)
        ? parsed.amendementId
        : null;
    return {
      match: Boolean(parsed.match) && id !== null,
      amendementId: id,
      justification: String(parsed.justification ?? ""),
      confiance: Math.max(0, Math.min(1, parsed.confiance))
    };
  }
  // Fallback : meilleur score cosinus si ≥ 0.6, étiqueté « automatique »
  const best = top10[0];
  if (best && best.score >= 0.6) {
    return {
      match: true,
      amendementId: best.id,
      justification: "Correspondance sémantique automatique (mode dégradé).",
      confiance: best.score,
      auto: true
    };
  }
  return { match: false, amendementId: null, justification: "", confiance: 0 };
}

// ---- 5. Synthèse des avis (dashboard député) -------------------------

export type SyntheseOut = {
  synthese: string;
  verbatims: string[];
  repartition: { pour: number; contre: number; nuance: number };
  sources: Source[];
};

export async function syntheseAvis(
  dossier: { titre: string; sourceUrl: string },
  commentairesOk: { texte: string; sentiment: number; upvotes: number }[]
): Promise<SyntheseOut> {
  const pour = commentairesOk.filter((c) => c.sentiment > 0).length;
  const contre = commentairesOk.filter((c) => c.sentiment < 0).length;
  const nuance = commentairesOk.filter((c) => c.sentiment === 0).length;

  if (commentairesOk.length === 0) {
    return {
      synthese: "Aucun avis citoyen n'a encore été déposé sur ce dossier.",
      verbatims: [],
      repartition: { pour: 0, contre: 0, nuance: 0 },
      sources: []
    };
  }

  const corpus = commentairesOk
    .map((c, i) => `[${i}] (sentiment ${c.sentiment}, ${c.upvotes} soutiens) « ${c.texte} »`)
    .join("\n");

  const raw = await chat(
    [
      sys(
        "Synthétise les avis citoyens de façon neutre en préservant la nuance. " +
          "Tu DOIS citer entre 3 et 5 verbatims exacts (recopiés mot pour mot " +
          "depuis les commentaires fournis, sans les modifier). " +
          'Format : {"synthese": string, "verbatims": string[] (3 à 5, exacts), ' +
          '"repartition": {"pour": int, "contre": int, "nuance": int}, ' +
          '"sources": [{"url","titre"}]}.'
      ),
      {
        role: "user",
        content:
          `Dossier : « ${dossier.titre} » (${dossier.sourceUrl}).\n` +
          `Répartition observée : ${pour} favorables, ${contre} défavorables, ${nuance} nuancés.\n\n` +
          `Commentaires :\n${corpus}`
      }
    ],
    { model: MODELS.main, json: true, maxTokens: 1200, mockKey: `synthese:${hashKey(dossier.titre)}` }
  );

  const parsed = parseJsonLoose<any>(raw);
  if (parsed && typeof parsed.synthese === "string") {
    // On ne garde que les verbatims réellement présents en BDD (garde-fou).
    const textes = commentairesOk.map((c) => c.texte);
    const verbatims: string[] = Array.isArray(parsed.verbatims)
      ? parsed.verbatims
          .map(String)
          .map((v: string) => v.trim())
          .filter((v: string) => v.length > 3)
          .filter((v: string) =>
            textes.some((t) => t.includes(v) || v.includes(t) || t === v)
          )
      : [];
    const finalVerbatims =
      verbatims.length >= 3 ? verbatims.slice(0, 5) : topUpvoted(commentairesOk, 3);
    return {
      synthese: parsed.synthese,
      verbatims: finalVerbatims,
      repartition: { pour, contre, nuance },
      sources: validateSources(parsed.sources, [dossier.sourceUrl])
    };
  }

  // Fallback : stats brutes + 3 commentaires les plus upvotés
  return {
    synthese:
      `Sur ${commentairesOk.length} avis exprimés : ${pour} favorables, ` +
      `${contre} défavorables, ${nuance} nuancés. Synthèse détaillée indisponible ` +
      "(mode dégradé) — verbatims les plus soutenus ci-dessous.",
    verbatims: topUpvoted(commentairesOk, 3),
    repartition: { pour, contre, nuance },
    sources: [{ url: dossier.sourceUrl, titre: "Dossier législatif" }]
  };
}

function topUpvoted(
  comments: { texte: string; upvotes: number }[],
  n: number
): string[] {
  return [...comments]
    .sort((a, b) => b.upvotes - a.upvotes)
    .slice(0, n)
    .map((c) => c.texte);
}

// ---- 6a. Brief de sujet (RDV) ----------------------------------------

export type ContenuSourceOut = { contenu: string; sources: Source[] };

export async function briefSujet(
  sujet: string,
  dossiers: { titre: string; expose: string; sourceUrl: string }[]
): Promise<ContenuSourceOut> {
  const allowed = dossiers.map((d) => d.sourceUrl);
  const ctx = dossiers
    .map((d) => `- « ${d.titre} » (${d.sourceUrl}) : ${d.expose.slice(0, 500)}`)
    .join("\n");
  const raw = await chat(
    [
      sys('Format : {"contenu": string (3 phrases max), "sources": [{"url","titre"}]}.'),
      {
        role: "user",
        content:
          `Sujet du rendez-vous : « ${sujet} ».\n\n` +
          (dossiers.length
            ? `Dossiers concernés :\n${ctx}`
            : "Aucun dossier rattaché.") +
          "\n\nRédige un brief factuel de 3 phrases pour préparer ce rendez-vous."
      }
    ],
    { model: MODELS.main, json: true, mockKey: `brief:${hashKey(sujet)}` }
  );
  const parsed = parseJsonLoose<any>(raw);
  if (parsed && typeof parsed.contenu === "string") {
    return { contenu: parsed.contenu, sources: validateSources(parsed.sources, allowed) };
  }
  return {
    contenu: `Rendez-vous sur le thème : ${sujet}. ` + (dossiers.length ? `Dossiers liés : ${dossiers.map((d) => d.titre).join(", ")}.` : ""),
    sources: dossiers.map((d) => ({ url: d.sourceUrl, titre: d.titre }))
  };
}

// ---- 6b. Résumé de document (upload PDF) -----------------------------

export async function resumeDocument(
  texte: string,
  contexte: { sourceUrl?: string; titre?: string } = {}
): Promise<ContenuSourceOut> {
  const raw = await chat(
    [
      sys('Format : {"contenu": string (5 phrases max), "sources": []}. ' + "Résume factuellement le document fourni."),
      { role: "user", content: `Document :\n${texte.slice(0, 6000)}` }
    ],
    { model: MODELS.main, json: true, maxTokens: 800, mockKey: `doc:${hashKey(texte)}` }
  );
  const parsed = parseJsonLoose<any>(raw);
  if (parsed && typeof parsed.contenu === "string") {
    return { contenu: parsed.contenu, sources: [] };
  }
  return { contenu: texte.slice(0, 500).replace(/\s+\S*$/, "") + "…", sources: [] };
}

// ---- util -------------------------------------------------------------

function hashKey(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = (h * 33) ^ text.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

export { cosine };
