import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  ensureResumeDossier,
  ensureResumeAmendement,
  mapLimit
} from "@/lib/data";
import { embed } from "@/lib/llmaas";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Préchauffage : génère et met en cache tous les résumés IA (dossiers +
 * amendements) et garantit un embedding sur chaque amendement. Rend les pages
 * instantanées pour la démo. Idempotent (ne régénère pas ce qui est déjà en BDD).
 */
export async function POST() {
  // Réservé au rôle depute : préchauffage coûteux (résumés + embeddings).
  const user = await requireUser();
  if (!user || user.role !== "depute") {
    return NextResponse.json({ error: "Réservé au rôle député" }, { status: 403 });
  }
  const dossiers = await prisma.dossier.findMany({ include: { amendements: true } });

  let resumesDossiers = 0;
  let resumesAmendements = 0;
  let embeddings = 0;

  for (const d of dossiers) {
    if (!d.resumeIA) {
      await ensureResumeDossier(d);
      resumesDossiers++;
    }
    // Embeddings manquants
    const sansEmbedding = d.amendements.filter((a) => !a.embedding);
    if (sansEmbedding.length > 0) {
      const vecs = await embed(
        sansEmbedding.map((a) => `${a.dispositif} ${a.exposeSommaire}`)
      );
      await mapLimit(sansEmbedding, 8, async (a, i) => {
        await prisma.amendement.update({
          where: { id: a.id },
          data: { embedding: JSON.stringify(vecs[i]) }
        });
      });
      embeddings += sansEmbedding.length;
    }
    // Résumés d'amendements manquants
    const sansResume = d.amendements.filter((a) => !a.resumeIA);
    await mapLimit(sansResume, 4, async (a) => {
      await ensureResumeAmendement(a);
      resumesAmendements++;
    });
  }

  return NextResponse.json({
    ok: true,
    resumesDossiers,
    resumesAmendements,
    embeddings
  });
}
