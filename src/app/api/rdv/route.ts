import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { briefSujet } from "@/lib/ia";
import { toJsonField } from "@/lib/sources";

export const dynamic = "force-dynamic";

/**
 * Création d'un rendez-vous (F6) par un citoyen ou un représentant.
 * Le créneau choisi doit appartenir au député sélectionné et être encore
 * libre (course possible si deux demandes visent le même créneau) ; il est
 * réservé de façon atomique avec la création du RDV. Un brief IA sourcé sur
 * les dossiers sélectionnés est généré pour préparer l'échange.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (user.role !== "citoyen" && user.role !== "representant") {
    return NextResponse.json({ error: "Rôle non autorisé" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const sujet = String(body.sujet ?? "").trim();
  const deputeId = String(body.deputeId ?? "").trim();
  const creneauId = String(body.creneauId ?? "").trim();
  const dossierIds: string[] = Array.isArray(body.dossierIds)
    ? body.dossierIds.map(String)
    : [];
  if (!sujet || !deputeId || !creneauId) {
    return NextResponse.json({ error: "Sujet, député et créneau requis" }, { status: 400 });
  }

  const depute = await prisma.user.findFirst({ where: { id: deputeId, role: "depute" } });
  if (!depute) {
    return NextResponse.json({ error: "Député introuvable" }, { status: 404 });
  }

  const dossiers = await prisma.dossier.findMany({
    where: { id: { in: dossierIds } }
  });

  const brief = await briefSujet(
    sujet,
    dossiers.map((d) => ({ titre: d.titre, expose: d.expose, sourceUrl: d.sourceUrl }))
  );

  try {
    const rdv = await prisma.$transaction(async (tx) => {
      const creneau = await tx.creneau.findFirst({
        where: { id: creneauId, deputeId, statut: "libre", publicCible: user.role }
      });
      if (!creneau) {
        throw new Error("CRENEAU_INDISPONIBLE");
      }
      await tx.creneau.update({ where: { id: creneau.id }, data: { statut: "reserve" } });
      return tx.rendezVous.create({
        data: {
          deputeId,
          demandeurId: user.id,
          creneauId: creneau.id,
          typeDemandeur: user.role,
          sujet,
          briefIA: JSON.stringify(brief),
          sources: toJsonField(brief.sources),
          date: creneau.debut,
          statut: "demande",
          rdvDossiers: {
            create: dossiers.map((d) => ({ dossierId: d.id }))
          }
        }
      });
    });

    return NextResponse.json({ ok: true, rdvId: rdv.id });
  } catch (e) {
    if (e instanceof Error && e.message === "CRENEAU_INDISPONIBLE") {
      return NextResponse.json(
        { error: "Ce créneau vient d'être réservé par quelqu'un d'autre. Choisissez-en un autre." },
        { status: 409 }
      );
    }
    throw e;
  }
}
