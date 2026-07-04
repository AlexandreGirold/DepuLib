import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Accepter / refuser un RDV (F6). Réservé au rôle depute : le collaborateur ne
 * peut pas agir (F10) — vérifié côté serveur en plus des boutons désactivés.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (user.role !== "depute") {
    return NextResponse.json(
      { error: "Seul le député peut accepter ou refuser un rendez-vous." },
      { status: 403 }
    );
  }

  const { rdvId, statut } = await req.json().catch(() => ({}));
  if (!rdvId || !["accepte", "refuse"].includes(statut)) {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }

  const rdv = await prisma.rendezVous.findUnique({ where: { id: String(rdvId) } });
  if (!rdv || rdv.deputeId !== user.id) {
    return NextResponse.json({ error: "Rendez-vous introuvable" }, { status: 404 });
  }

  const updated = await prisma.rendezVous.update({
    where: { id: rdv.id },
    data: { statut }
  });

  return NextResponse.json({ ok: true, statut: updated.statut });
}
