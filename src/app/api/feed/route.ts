import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { genereFeed } from "@/lib/ia";
import { toJsonField } from "@/lib/sources";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Génère (ou régénère) le feed mensuel personnalisé (F9) d'un citoyen, à partir
 * des dossiers filtrés par sa circonscription et par ses dossiers commentés.
 * Persiste un FeedItem.
 */
export async function POST() {
  const user = await requireUser();
  if (!user || user.role !== "citoyen") {
    return NextResponse.json({ error: "Réservé aux citoyens" }, { status: 403 });
  }

  const commentes = await prisma.commentaire.findMany({
    where: { userId: user.id },
    select: { dossier: { select: { id: true, titre: true } } },
    distinct: ["dossierId"]
  });
  const commentesTitres = Array.from(
    new Set(commentes.map((c) => c.dossier.titre))
  );

  // Pour le POC : tous les dossiers sont considérés d'intérêt (la circonscription
  // n'étant pas portée par les dossiers de démo), en priorisant ceux commentés.
  const dossiers = await prisma.dossier.findMany({
    orderBy: { titre: "asc" }
  });

  const feed = await genereFeed(
    { circonscription: user.circonscription, commentesTitres },
    dossiers.map((d) => ({ titre: d.titre, expose: d.expose, sourceUrl: d.sourceUrl }))
  );

  const periode = "2026-07";
  // Remplace le feed du mois s'il existe déjà
  await prisma.feedItem.deleteMany({ where: { userId: user.id, periode } });
  const item = await prisma.feedItem.create({
    data: {
      userId: user.id,
      periode,
      contenuIA: JSON.stringify({ items: feed.items }),
      sources: toJsonField(feed.sources) ?? "[]"
    }
  });

  return NextResponse.json({ ok: true, feedId: item.id, items: feed.items });
}
