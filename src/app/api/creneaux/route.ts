import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Ouverture d'un créneau de disponibilité par le député (F6). Réservé au rôle
 * depute : le collaborateur ne peut pas modifier l'agenda (lecture seule,
 * comme pour accepter/refuser un RDV).
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (user.role !== "depute") {
    return NextResponse.json(
      { error: "Seul le député peut ouvrir des créneaux." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const debut = new Date(String(body.debut ?? ""));
  const fin = new Date(String(body.fin ?? ""));
  const publicCible = String(body.publicCible ?? "");

  if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime())) {
    return NextResponse.json({ error: "Date de début ou de fin invalide" }, { status: 400 });
  }
  if (!["citoyen", "representant"].includes(publicCible)) {
    return NextResponse.json({ error: "Public visé invalide" }, { status: 400 });
  }
  if (fin.getTime() <= debut.getTime()) {
    return NextResponse.json({ error: "L'heure de fin doit être après l'heure de début" }, { status: 400 });
  }
  if (debut.getTime() <= Date.now()) {
    return NextResponse.json({ error: "Le créneau doit être dans le futur" }, { status: 400 });
  }

  const creneau = await prisma.creneau.create({
    data: { deputeId: user.id, debut, fin, publicCible, statut: "libre" }
  });

  return NextResponse.json({ ok: true, creneau });
}
