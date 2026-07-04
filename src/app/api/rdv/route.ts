import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { briefSujet } from "@/lib/ia";
import { toJsonField } from "@/lib/sources";

export const dynamic = "force-dynamic";

/**
 * Création d'un rendez-vous (F6) par un citoyen ou un représentant.
 * Génère un brief IA sourcé sur les dossiers sélectionnés.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (user.role !== "citoyen" && user.role !== "representant") {
    return NextResponse.json({ error: "Rôle non autorisé" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const sujet = String(body.sujet ?? "").trim();
  const dossierIds: string[] = Array.isArray(body.dossierIds)
    ? body.dossierIds.map(String)
    : [];
  const dateStr = String(body.date ?? "");
  if (!sujet || !dateStr) {
    return NextResponse.json({ error: "Sujet et date requis" }, { status: 400 });
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  }

  // Député destinataire : la première (unique) députée seedée pour ce POC.
  const depute = await prisma.user.findFirst({ where: { role: "depute" } });
  if (!depute) {
    return NextResponse.json({ error: "Aucun député disponible" }, { status: 500 });
  }

  const dossiers = await prisma.dossier.findMany({
    where: { id: { in: dossierIds } }
  });

  const brief = await briefSujet(
    sujet,
    dossiers.map((d) => ({ titre: d.titre, expose: d.expose, sourceUrl: d.sourceUrl }))
  );

  const rdv = await prisma.rendezVous.create({
    data: {
      deputeId: depute.id,
      demandeurId: user.id,
      typeDemandeur: user.role,
      sujet,
      briefIA: JSON.stringify(brief),
      sources: toJsonField(brief.sources),
      date,
      statut: "demande",
      rdvDossiers: {
        create: dossiers.map((d) => ({ dossierId: d.id }))
      }
    }
  });

  return NextResponse.json({ ok: true, rdvId: rdv.id });
}
