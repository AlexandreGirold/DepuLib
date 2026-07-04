import { prisma } from "./db";
import {
  resumeDossier,
  resumeAmendement,
  syntheseAvis,
  SyntheseOut
} from "./ia";
import type { Source } from "./sources";
import { parseJsonField, toJsonField } from "./sources";

/**
 * Accès données + génération IA paresseuse avec cache BDD systématique.
 * L'UI ne lit que la BDD (règle §5.2).
 */

/**
 * Commission suivie par un utilisateur député/collaborateur. Le collaborateur
 * hérite de la commission de SON député (résolu via deputeId), pas de la sienne.
 */
export async function getCommissionForUser(user: {
  role: string;
  commission?: string | null;
  deputeId?: string | null;
}): Promise<string> {
  if (user.role === "collaborateur" && user.deputeId) {
    const depute = await prisma.user.findUnique({ where: { id: user.deputeId } });
    if (depute?.commission) return depute.commission;
  }
  return user.commission ?? "Commission des lois";
}

export async function getDossiers() {
  return prisma.dossier.findMany({
    orderBy: { titre: "asc" },
    include: { _count: { select: { amendements: true, commentaires: true } } }
  });
}

export async function getDossiersCommission(commission: string) {
  return prisma.dossier.findMany({
    where: { commission },
    orderBy: { titre: "asc" },
    include: { _count: { select: { amendements: true, commentaires: true } } }
  });
}

export type DossierComplet = Awaited<ReturnType<typeof getDossierComplet>>;

export async function getDossierComplet(id: string) {
  return prisma.dossier.findUnique({
    where: { id },
    include: {
      amendements: { orderBy: { numero: "asc" } },
      commentaires: {
        include: { user: true, amendement: true },
        orderBy: { upvotes: "desc" }
      }
    }
  });
}

/**
 * Génère (si absent) et met en cache le résumé IA du dossier.
 */
export async function ensureResumeDossier(dossier: {
  id: string;
  titre: string;
  expose: string;
  sourceUrl: string;
  resumeIA: string | null;
  sources: unknown;
  json: unknown;
}): Promise<{ resume: string; points_cles: string[]; sources: Source[] }> {
  if (dossier.resumeIA) {
    const parsed = safeParse(dossier.resumeIA);
    return {
      resume: parsed?.resume ?? dossier.resumeIA,
      points_cles: parsed?.points_cles ?? [],
      sources: parseJsonField<Source[]>(dossier.sources) ?? []
    };
  }
  const raw = parseJsonField<any>(dossier.json);
  const out = await resumeDossier({
    id: dossier.id,
    titre: dossier.titre,
    expose: dossier.expose,
    sourceUrl: dossier.sourceUrl,
    resumeFallback: raw?.resumeFallback,
    pointsClesFallback: raw?.pointsClesFallback
  });
  await prisma.dossier.update({
    where: { id: dossier.id },
    data: {
      resumeIA: JSON.stringify({ resume: out.resume, points_cles: out.points_cles }),
      sources: toJsonField(out.sources)
    }
  });
  return out;
}

/**
 * Génère (si absent) et met en cache le résumé IA d'un amendement.
 */
export async function ensureResumeAmendement(amdt: {
  id: string;
  numero: string;
  auteur: string;
  dispositif: string;
  exposeSommaire: string;
  sourceUrl: string;
  resumeIA: string | null;
  sources: unknown;
}): Promise<{ resume: string; sources: Source[] }> {
  if (amdt.resumeIA) {
    return {
      resume: amdt.resumeIA,
      sources: parseJsonField<Source[]>(amdt.sources) ?? []
    };
  }
  const out = await resumeAmendement(amdt);
  await prisma.amendement.update({
    where: { id: amdt.id },
    data: { resumeIA: out.resume, sources: toJsonField(out.sources) }
  });
  return out;
}

/** Génère la synthèse des avis et la met en cache (BDD) — §5.2. */
export async function regenerreSynthese(
  dossierId: string
): Promise<SyntheseOut> {
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: {
      commentaires: {
        where: { moderationFlag: "ok" },
        select: { texte: true, sentiment: true, upvotes: true }
      }
    }
  });
  if (!dossier) throw new Error("Dossier introuvable");
  const out = await syntheseAvis(
    { titre: dossier.titre, sourceUrl: dossier.sourceUrl },
    dossier.commentaires
  );
  await prisma.dossier.update({
    where: { id: dossierId },
    data: { syntheseIA: JSON.stringify(out) }
  });
  return out;
}

/** Retourne la synthèse cachée si présente, sinon la génère et la met en cache. */
export async function ensureSynthese(
  dossier: { id: string; syntheseIA: string | null }
): Promise<SyntheseOut> {
  if (dossier.syntheseIA) {
    const parsed = safeParse(dossier.syntheseIA);
    if (parsed && typeof parsed.synthese === "string") return parsed as SyntheseOut;
  }
  return regenerreSynthese(dossier.id);
}

/** Exécute des tâches async avec une concurrence limitée. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return results;
}

function safeParse(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** Moyenne des sentiments des commentaires `ok` d'un dossier ou amendement. */
export function moyenneSentiment(
  commentaires: { sentiment: number; moderationFlag: string }[]
): { moyenne: number; count: number } {
  const ok = commentaires.filter((c) => c.moderationFlag === "ok");
  if (ok.length === 0) return { moyenne: 0, count: 0 };
  const sum = ok.reduce((s, c) => s + c.sentiment, 0);
  return { moyenne: sum / ok.length, count: ok.length };
}
