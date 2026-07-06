import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { readDocument } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Téléchargement d'un document déposé (F7/F8). Autorisé pour :
 * - l'uploader (représentant qui a déposé la pièce) ;
 * - le député destinataire du RDV, ou son collaborateur ;
 * - tout député/collaborateur pour une pièce jointe à une contribution
 *   (surface de travail parlementaire commune).
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    include: { rdv: { select: { deputeId: true } } }
  });
  if (!doc) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const deputeId = user.role === "depute" ? user.id : user.deputeId;
  const autorise =
    doc.uploaderId === user.id ||
    (doc.rdvId ? doc.rdv?.deputeId === deputeId : deputeId != null);
  if (!autorise) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  let body: Buffer;
  try {
    body = await readDocument(doc.path);
  } catch {
    return NextResponse.json({ error: "Fichier indisponible" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.filename)}"`
    }
  });
}
