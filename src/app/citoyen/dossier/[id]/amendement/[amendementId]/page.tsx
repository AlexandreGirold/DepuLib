import { fr } from "@codegouvfr/react-dsfr";
import { Breadcrumb } from "@codegouvfr/react-dsfr/Breadcrumb";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/guards";
import { getDossierComplet } from "@/lib/data";
import { prisma } from "@/lib/db";
import { AvisListe, AvisItem } from "@/components/AvisListe";

export const dynamic = "force-dynamic";

export default async function CitoyenAmendementAvisPage({
  params
}: {
  params: { id: string; amendementId: string };
}) {
  const user = await requireRole(["citoyen"]);
  const dossier = await getDossierComplet(params.id);
  if (!dossier) notFound();

  const amendement = dossier.amendements.find((a) => a.id === params.amendementId);
  if (!amendement) notFound();

  const comms = dossier.commentaires.filter((c) => c.amendementId === amendement.id);

  const myUpvotes = await prisma.upvoteComm.findMany({
    where: { userId: user.id, commentaireId: { in: comms.map((c) => c.id) } },
    select: { commentaireId: true }
  });
  const upvotedSet = new Set(myUpvotes.map((u) => u.commentaireId));

  const avis: AvisItem[] = comms.map((c) => ({
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
        currentPageLabel={`Avis — Amendement n°${amendement.numero}`}
        homeLinkProps={{ href: "/citoyen" }}
        segments={[
          { label: "Dossiers en débat", linkProps: { href: "/citoyen" } },
          { label: dossier.titre, linkProps: { href: `/citoyen/dossier/${dossier.id}` } }
        ]}
      />
      <h1 className={fr.cx("fr-mt-2w", "fr-mb-1v")}>
        Avis sur l'amendement n°{amendement.numero}
      </h1>
      <p className={fr.cx("fr-text--sm", "fr-mb-3w")} style={{ color: "var(--text-mention-grey)" }}>
        {amendement.auteur}
      </p>
      <AvisListe initial={avis} />
    </div>
  );
}
