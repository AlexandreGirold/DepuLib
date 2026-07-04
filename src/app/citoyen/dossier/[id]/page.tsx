import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/guards";
import { getDossierComplet, ensureResumeDossier, readResumeAmendement, moyenneSentiment } from "@/lib/data";
import { DossierTabs } from "@/components/DossierTabs";
import type { AmendementView } from "@/components/AmendementCard";
import type { AvisItem } from "@/components/AvisListe";
import { prisma } from "@/lib/db";
import type { Source } from "@/lib/sources";

export const dynamic = "force-dynamic";

export default async function DossierPage({ params }: { params: { id: string } }) {
  const user = await requireRole(["citoyen"]);
  const dossier = await getDossierComplet(params.id);
  if (!dossier) notFound();

  const resume = await ensureResumeDossier(dossier);

  // Résumés d'amendements : lecture seule du cache pré-généré à l'ingestion
  // (`npm run warm`). Aucune génération IA au rendu — cf. readResumeAmendement.
  const amendementsView: AmendementView[] = dossier.amendements.map((a) => {
    const r = readResumeAmendement(a);
    const comms = dossier.commentaires.filter((c) => c.amendementId === a.id);
    const { moyenne, count } = moyenneSentiment(comms);
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
      sentimentMoyen: moyenne,
      nbCommentaires: count
    };
  });

  // Avis existants + état d'upvote de l'utilisateur courant
  const myUpvotes = await prisma.upvoteComm.findMany({
    where: { userId: user.id, commentaireId: { in: dossier.commentaires.map((c) => c.id) } },
    select: { commentaireId: true }
  });
  const upvotedSet = new Set(myUpvotes.map((u) => u.commentaireId));

  const avis: AvisItem[] = dossier.commentaires.map((c) => ({
    id: c.id,
    texte: c.texte,
    sentiment: c.sentiment,
    moderationFlag: c.moderationFlag,
    moderationMotif: c.moderationMotif,
    upvotes: c.upvotes,
    hasUpvoted: upvotedSet.has(c.id),
    author: c.user.displayName,
    amendementNumero: c.amendement?.numero ?? null,
    createdAt: c.createdAt.toISOString()
  }));

  return (
    <div className={fr.cx("fr-container", "fr-py-4w")}>
      <div className={fr.cx("fr-mb-4w")}>
        <Link
          href={`/citoyen?commission=${encodeURIComponent(dossier.commission)}`}
          className={fr.cx("fr-link", "fr-icon-arrow-left-line", "fr-link--icon-left")}
        >
          Retour aux lois
        </Link>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Badge severity={dossier.statut.includes("séance") ? "warning" : "info"} small>
          {dossier.statut}
        </Badge>
        <Badge small noIcon>{dossier.numero}</Badge>
        <Badge small noIcon>{dossier.commission}</Badge>
      </div>
      <div className={fr.cx("fr-grid-row", "fr-grid-row--middle", "fr-mt-2w")} style={{ gap: 16 }}>
        <h1 className={fr.cx("fr-mb-0")}>{dossier.titre}</h1>
      </div>
      <Link
        href={`/citoyen/rdv?dossierId=${dossier.id}`}
        className={fr.cx("fr-btn", "fr-btn--secondary", "fr-icon-calendar-line", "fr-btn--icon-left", "fr-mt-2w", "fr-mb-3w")}
      >
        Demander un rendez-vous à propos de ce dossier
      </Link>

      <DossierTabs
        dossierId={dossier.id}
        expose={dossier.expose}
        resume={resume}
        sourceUrl={dossier.sourceUrl}
        amendements={amendementsView}
        avis={avis}
      />
    </div>
  );
}
