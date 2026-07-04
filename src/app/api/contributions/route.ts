import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { resumeDocument } from "@/lib/ia";
import { toJsonField } from "@/lib/sources";

export const dynamic = "force-dynamic";

/**
 * Dépôt d'une contribution structurée par un représentant d'intérêts (F8).
 * position ∈ {favorable, defavorable, amendement}. Résumé IA de l'argumentaire.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user || user.role !== "representant") {
    return NextResponse.json({ error: "Réservé aux représentants d'intérêts." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const dossierId = String(body.dossierId ?? "");
  const position = String(body.position ?? "");
  const argumentaire = String(body.argumentaire ?? "").trim();

  if (!dossierId || !["favorable", "defavorable", "amendement"].includes(position)) {
    return NextResponse.json({ error: "Dossier et position requis" }, { status: 400 });
  }
  if (argumentaire.length < 10) {
    return NextResponse.json({ error: "Argumentaire trop court" }, { status: 400 });
  }

  const dossier = await prisma.dossier.findUnique({ where: { id: dossierId } });
  if (!dossier) return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });

  const resume = await resumeDocument(argumentaire, {
    sourceUrl: dossier.sourceUrl,
    titre: dossier.titre
  });

  const contrib = await prisma.contribution.create({
    data: {
      dossierId,
      userId: user.id,
      position,
      argumentaire,
      resumeIA: resume.contenu,
      sources: toJsonField(resume.sources)
    }
  });

  return NextResponse.json({ ok: true, contributionId: contrib.id });
}
