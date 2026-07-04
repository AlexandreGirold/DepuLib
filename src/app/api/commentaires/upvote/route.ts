import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { commentaireId } = await req.json().catch(() => ({}));
  if (!commentaireId) {
    return NextResponse.json({ error: "commentaireId requis" }, { status: 400 });
  }

  const comment = await prisma.commentaire.findUnique({ where: { id: String(commentaireId) } });
  if (!comment) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  // 1 vote par utilisateur — la contrainte @@unique empêche le double-vote.
  try {
    await prisma.upvoteComm.create({
      data: { userId: user.id, commentaireId: comment.id }
    });
  } catch {
    // Déjà voté : on renvoie l'état courant sans réincrémenter.
    return NextResponse.json({ upvotes: comment.upvotes, alreadyVoted: true });
  }

  const updated = await prisma.commentaire.update({
    where: { id: comment.id },
    data: { upvotes: { increment: 1 } }
  });

  return NextResponse.json({ upvotes: updated.upvotes });
}
