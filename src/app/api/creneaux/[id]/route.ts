import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Fermeture d'un créneau encore libre (F6). Réservé au rôle depute. Un
 * créneau déjà réservé par un RDV ne peut pas être retiré ici — le député doit
 * d'abord refuser le rendez-vous concerné.
 */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (user.role !== "depute") {
    return NextResponse.json(
      { error: "Seul le député peut retirer un créneau." },
      { status: 403 }
    );
  }

  const creneau = await prisma.creneau.findFirst({ where: { id: params.id, deputeId: user.id } });
  if (!creneau) {
    return NextResponse.json({ error: "Créneau introuvable" }, { status: 404 });
  }
  if (creneau.statut !== "libre") {
    return NextResponse.json({ error: "Ce créneau est déjà réservé" }, { status: 409 });
  }

  await prisma.creneau.delete({ where: { id: creneau.id } });
  return NextResponse.json({ ok: true });
}
