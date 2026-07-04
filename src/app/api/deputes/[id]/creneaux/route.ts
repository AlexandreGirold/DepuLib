import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Créneaux de disponibilité libres d'un député, filtrés selon le public visé
 * par le rôle du demandeur (le député ouvre certains créneaux aux citoyens,
 * d'autres aux représentants d'intérêts). Appelé côté client à l'étape 2 du
 * formulaire de RDV, une fois le député choisi.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (user.role !== "citoyen" && user.role !== "representant") {
    return NextResponse.json({ error: "Rôle non autorisé" }, { status: 403 });
  }

  const depute = await prisma.user.findFirst({ where: { id: params.id, role: "depute" } });
  if (!depute) {
    return NextResponse.json({ error: "Député introuvable" }, { status: 404 });
  }

  const creneaux = await prisma.creneau.findMany({
    where: {
      deputeId: params.id,
      statut: "libre",
      publicCible: user.role,
      debut: { gte: new Date() }
    },
    orderBy: { debut: "asc" },
    select: { id: true, debut: true, fin: true }
  });

  return NextResponse.json({ ok: true, creneaux });
}
