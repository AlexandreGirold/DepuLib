import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { Breadcrumb } from "@codegouvfr/react-dsfr/Breadcrumb";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/guards";
import { getDossierComplet, ensureResumeDossier, ensureResumeAmendement, moyenneSentiment, mapLimit } from "@/lib/data";
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

  // Résumés d'amendements (génération paresseuse + cache, concurrence limitée)
  const amendementsView: AmendementView[] = await mapLimit(
    dossier.amendements,
    5,
    async (a) => {
      const r = await ensureResumeAmendement(a);
      const comms = dossier.commentaires.filter((c) => c.amendementId === a.id);
      const { count } = moyenneSentiment(comms);
      return {
        id: a.id,
        numero: a.numero,
        auteur: a.auteur,
        resume: r.resume,
        dispositif: a.dispositif,
        sourceUrl: a.sourceUrl,
        sources: r.sources,
        upvotes: a.upvotes,
        nbCommentaires: count,
        avisHref: `/citoyen/dossier/${dossier.id}/amendement/${a.id}`
      };
    }
  );

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
      <Breadcrumb
        currentPageLabel={dossier.titre}
        homeLinkProps={{ href: "/citoyen" }}
        segments={[{ label: "Dossiers en débat", linkProps: { href: "/citoyen" } }]}
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Badge severity={dossier.statut.includes("séance") ? "warning" : "info"} small>
          {dossier.statut}
        </Badge>
        <Badge small noIcon>{dossier.numero}</Badge>
        <Badge small noIcon>{dossier.commission}</Badge>
      </div>
      <h1 className={fr.cx("fr-mt-2w")}>{dossier.titre}</h1>

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
