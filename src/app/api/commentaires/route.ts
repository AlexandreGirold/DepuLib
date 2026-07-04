import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { classifieCommentaire, matchAmendement } from "@/lib/ia";
import { ensureResumeAmendement } from "@/lib/data";
import { embed } from "@/lib/llmaas";
import { topKByCosine } from "@/lib/cosinus";
import { parseJsonField } from "@/lib/sources";

export const dynamic = "force-dynamic";

const SEUIL_CONFIANCE = 0.7;

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { dossierId, texte } = await req.json().catch(() => ({}));
  const clean = String(texte ?? "").trim();
  if (!dossierId || clean.length < 3) {
    return NextResponse.json({ error: "Commentaire trop court" }, { status: 400 });
  }

  const dossier = await prisma.dossier.findUnique({ where: { id: String(dossierId) } });
  if (!dossier) return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });

  // (a) Classification : sentiment + modération
  const classif = await classifieCommentaire(clean);

  // Création du commentaire (jamais supprimé, même si flaggé — modération transparente)
  const commentaire = await prisma.commentaire.create({
    data: {
      dossierId: dossier.id,
      userId: user.id,
      texte: clean,
      sentiment: classif.sentiment,
      moderationFlag: classif.flag,
      moderationMotif: classif.motif ?? null
    }
  });

  // Si flaggé : on ne lance pas le pipeline de match (exclu des agrégats)
  if (classif.flag !== "ok") {
    return NextResponse.json({
      commentaireId: commentaire.id,
      moderationFlag: classif.flag,
      moderationMotif: classif.motif ?? null,
      sentiment: classif.sentiment
    });
  }

  // (b) Embedding + top 10 amendements par cosinus
  const amendements = await prisma.amendement.findMany({
    where: { dossierId: dossier.id }
  });

  let matchResult = null;
  let amendementPayload = null;
  let auto = false;

  if (amendements.length > 0) {
    const [queryVec] = await embed([clean]);
    const top = topKByCosine(
      queryVec,
      amendements,
      (a) => parseJsonField<number[]>(a.embedding),
      10
    );

    const juge = await matchAmendement(
      clean,
      top.map((t) => ({
        id: t.item.id,
        numero: t.item.numero,
        auteur: t.item.auteur,
        dispositif: t.item.dispositif,
        exposeSommaire: t.item.exposeSommaire,
        score: t.score
      }))
    );

    auto = Boolean(juge.auto);
    // Seuil de confiance 0,7 (§8). En mode fallback auto, on retient dès 0,6.
    const seuil = juge.auto ? 0.6 : SEUIL_CONFIANCE;
    if (juge.match && juge.amendementId && juge.confiance >= seuil) {
      const amdt = amendements.find((a) => a.id === juge.amendementId);
      if (amdt) {
        const r = await ensureResumeAmendement(amdt);
        matchResult = juge;
        amendementPayload = {
          id: amdt.id,
          numero: amdt.numero,
          auteur: amdt.auteur,
          resumeIA: r.resume,
          sourceUrl: amdt.sourceUrl,
          sources: r.sources,
          upvotes: amdt.upvotes
        };
      }
    }
  }

  return NextResponse.json({
    commentaireId: commentaire.id,
    moderationFlag: "ok",
    sentiment: classif.sentiment,
    match: Boolean(matchResult),
    auto,
    amendement: amendementPayload
  });
}
