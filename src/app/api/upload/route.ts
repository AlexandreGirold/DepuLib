import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { resumeDocument } from "@/lib/ia";
import { toJsonField } from "@/lib/sources";
import { uploadDocument } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_SIZE = 10 * 1024 * 1024; // 10 Mo

/**
 * Upload d'un ou plusieurs PDF (F7) par un représentant, rattaché à un RDV ou
 * une contribution. Chaque fichier → bucket S3 + extraction texte. Un unique
 * résumé IA combiné sur l'ensemble des fichiers du dépôt.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user || user.role !== "representant") {
    return NextResponse.json(
      { error: "Réservé aux représentants d'intérêts." },
      { status: 403 }
    );
  }

  const form = await req.formData();
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  const rdvId = form.get("rdvId") ? String(form.get("rdvId")) : null;
  const contributionId = form.get("contributionId")
    ? String(form.get("contributionId"))
    : null;

  if (files.length === 0) {
    return NextResponse.json({ error: "Aucun fichier" }, { status: 400 });
  }

  const pdfParse = (await import("pdf-parse")).default;
  const created: { id: string; filename: string; texte: string }[] = [];

  for (const file of files) {
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `Fichier trop volumineux (max 10 Mo) : ${file.name}` },
        { status: 400 }
      );
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: `Seuls les PDF sont acceptés : ${file.name}` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const storedPath = await uploadDocument(key, buffer);

    let texte = "";
    try {
      const data = await pdfParse(buffer);
      texte = (data.text || "").trim();
    } catch {
      texte = "";
    }

    const doc = await prisma.document.create({
      data: {
        rdvId,
        contributionId,
        filename: file.name,
        path: storedPath,
        texteExtrait: texte.slice(0, 20000),
        resumeIA: null,
        sources: null,
        uploaderId: user.id
      }
    });
    created.push({ id: doc.id, filename: file.name, texte });
  }

  // Résumé combiné sur tous les documents du dépôt.
  const texteCombine = created
    .filter((d) => d.texte)
    .map((d) => `--- ${d.filename} ---\n${d.texte}`)
    .join("\n\n");

  const resume = texteCombine
    ? await resumeDocument(texteCombine)
    : { contenu: "Le texte des documents n'a pas pu être extrait.", sources: [] };

  // Le résumé combiné est stocké sur chaque Document du dépôt (affiché côté
  // député). On ne touche pas à rdv.briefIA : c'est le brief du *sujet*, distinct
  // du résumé des pièces jointes.
  await prisma.document.updateMany({
    where: { id: { in: created.map((d) => d.id) } },
    data: { resumeIA: resume.contenu, sources: toJsonField(resume.sources) }
  });

  // La contribution garde aussi son résumé agrégé (affiché dans la liste).
  if (contributionId) {
    await prisma.contribution.update({
      where: { id: contributionId },
      data: { resumeIA: resume.contenu, sources: toJsonField(resume.sources) }
    });
  }

  return NextResponse.json({
    ok: true,
    count: created.length,
    filenames: created.map((d) => d.filename),
    resumeIA: resume.contenu
  });
}
