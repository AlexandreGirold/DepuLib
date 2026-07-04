import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { regenerreSynthese } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * Génère (ou régénère) la synthèse des avis d'un dossier (F4).
 * Réservé aux rôles député / collaborateur.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user || (user.role !== "depute" && user.role !== "collaborateur")) {
    return NextResponse.json({ error: "Accès réservé" }, { status: 403 });
  }
  const { dossierId } = await req.json().catch(() => ({}));
  if (!dossierId) {
    return NextResponse.json({ error: "dossierId requis" }, { status: 400 });
  }
  const synthese = await regenerreSynthese(String(dossierId));
  return NextResponse.json(synthese);
}
