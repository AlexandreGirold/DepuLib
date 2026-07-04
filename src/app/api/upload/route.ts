import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { resumeDocument } from "@/lib/ia";
import { toJsonField } from "@/lib/sources";
import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_SIZE = 10 * 1024 * 1024; // 10 Mo

/**
 * Upload d'un PDF (F7) par un représentant, rattaché à un RDV ou une
 * contribution. Extraction texte (pdf-parse) + résumé IA.
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
  const file = form.get("file");
  const rdvId = form.get("rdvId") ? String(form.get("rdvId")) : null;
  const contributionId = form.get("contributionId")
    ? String(form.get("contributionId"))
    : null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 10 Mo)" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Seuls les PDF sont acceptés" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const uploadDir = process.env.UPLOAD_DIR || "./data/uploads";
  await fs.mkdir(uploadDir, { recursive: true });
  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const filePath = path.join(uploadDir, safeName);
  await fs.writeFile(filePath, buffer);

  // Extraction texte via pdf-parse
  let texte = "";
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    texte = (data.text || "").trim();
  } catch (e) {
    texte = "";
  }

  const resume = texte
    ? await resumeDocument(texte)
    : { contenu: "Le texte du document n'a pas pu être extrait.", sources: [] };

  const doc = await prisma.document.create({
    data: {
      rdvId,
      contributionId,
      filename: file.name,
      path: filePath,
      texteExtrait: texte.slice(0, 20000),
      resumeIA: resume.contenu,
      sources: toJsonField(resume.sources),
      uploaderId: user.id
    }
  });

  return NextResponse.json({
    ok: true,
    documentId: doc.id,
    filename: doc.filename,
    resumeIA: doc.resumeIA
  });
}
