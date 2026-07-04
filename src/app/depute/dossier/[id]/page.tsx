import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { Breadcrumb } from "@codegouvfr/react-dsfr/Breadcrumb";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/guards";
import { prisma } from "@/lib/db";
import {
  getDossierComplet,
  readResumeAmendement,
  ensureSynthese,
  moyenneSentiment
} from "@/lib/data";
import { DeputeDossierTabs, ContributionView } from "@/components/DeputeDossierTabs";
import type { AmendementView } from "@/components/AmendementCard";
import type { AvisItem } from "@/components/AvisListe";
import { parseJsonField, Source } from "@/lib/sources";

export const dynamic = "force-dynamic";

export default async function DeputeDossierPage({ params }: { params: { id: string } }) {
  await requireRole(["depute", "collaborateur"]);
  const dossier = await getDossierComplet(params.id);
  if (!dossier) notFound();

  const synthese = await ensureSynthese(dossier);

  // Lecture seule des résumés pré-générés à l'ingestion (`npm run warm`).
  const amendementsView: AmendementView[] = dossier.amendements.map((a) => {
    const r = readResumeAmendement(a);
    const comms = dossier.commentaires.filter((c) => c.amendementId === a.id);
    const { count } = moyenneSentiment(comms);
    return {
      id: a.id,
      numero: a.numero,
      auteur: a.auteur,
      article: a.article,
      sort: a.sort,
      resume: r.resume,
      dispositif: a.dispositif,
      sourceUrl: a.sourceUrl,
      sources: r.sources,
      upvotes: a.upvotes,
      nbCommentaires: count,
      avisHref: `/depute/dossier/${dossier.id}/amendement/${a.id}`
    };
  });

  // Côté député : on n'affiche pas les messages modérés (la modération
  // transparente reste consultable côté citoyen).
  const avis: AvisItem[] = dossier.commentaires
    .filter((c) => c.moderationFlag === "ok")
    .map((c) => ({
      id: c.id,
      texte: c.texte,
      sentiment: c.sentiment,
      moderationFlag: c.moderationFlag,
      moderationMotif: c.moderationMotif,
      upvotes: c.upvotes,
      hasUpvoted: false,
      author: c.user.displayName,
      amendementNumero: c.amendement?.numero ?? null,
      createdAt: c.createdAt.toISOString()
    }));

  const contribs = await prisma.contribution.findMany({
    where: { dossierId: dossier.id },
    include: {
      user: { include: { organisation: true } },
      documents: { select: { id: true, filename: true, resumeIA: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  const contributions: ContributionView[] = contribs.map((c) => ({
    id: c.id,
    auteur: c.user.displayName,
    organisation: c.user.organisation?.nomHatvp ?? null,
    position: c.position,
    argumentaire: c.argumentaire,
    resumeIA: c.resumeIA,
    sources: parseJsonField<Source[]>(c.sources) ?? [],
    documents: c.documents
  }));

  return (
    <div className={fr.cx("fr-container", "fr-py-4w")}>
      <Breadcrumb
        currentPageLabel={dossier.titre}
        homeLinkProps={{ href: "/depute/dashboard" }}
        segments={[{ label: "Tableau de bord", linkProps: { href: "/depute/dashboard" } }]}
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Badge severity={dossier.statut.includes("séance") ? "warning" : "info"} small>
          {dossier.statut}
        </Badge>
        <Badge small noIcon>{dossier.numero}</Badge>
        <Badge small noIcon>{dossier.commission}</Badge>
      </div>
      <h1 className={fr.cx("fr-mt-2w")}>{dossier.titre}</h1>

      <DeputeDossierTabs
        dossierId={dossier.id}
        synthese={synthese}
        avis={avis}
        amendements={amendementsView}
        contributions={contributions}
      />
    </div>
  );
}
