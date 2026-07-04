import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Soutenir un amendement (F1) : lie le commentaire à l'amendement et incrémente
 * Amendement.upvotes. Idempotent : si le commentaire est déjà lié, pas de
 * double incrément.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { commentaireId, amendementId } = await req.json().catch(() => ({}));
  if (!commentaireId || !amendementId) {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
  }

  const comment = await prisma.commentaire.findUnique({ where: { id: String(commentaireId) } });
  if (!comment || comment.userId !== user.id) {
    return NextResponse.json({ error: "Commentaire introuvable" }, { status: 404 });
  }
  const amdt = await prisma.amendement.findUnique({ where: { id: String(amendementId) } });
  if (!amdt) return NextResponse.json({ error: "Amendement introuvable" }, { status: 404 });

  if (comment.amendementId === amdt.id) {
    return NextResponse.json({ upvotes: amdt.upvotes, alreadyLinked: true });
  }

  // Anti double-comptage : un même utilisateur ne compte qu'une fois par
  // amendement, même s'il a plusieurs commentaires sur le dossier.
  const dejaSoutenu = await prisma.commentaire.count({
    where: { userId: user.id, amendementId: amdt.id }
  });

  await prisma.commentaire.update({
    where: { id: comment.id },
    data: { amendementId: amdt.id }
  });

  if (dejaSoutenu > 0) {
    return NextResponse.json({ upvotes: amdt.upvotes, alreadyLinked: true });
  }

  const updated = await prisma.amendement.update({
    where: { id: amdt.id },
    data: { upvotes: { increment: 1 } }
  });

  return NextResponse.json({ upvotes: updated.upvotes });
}
