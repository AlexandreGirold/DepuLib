import { fr } from "@codegouvfr/react-dsfr";
import { Breadcrumb } from "@codegouvfr/react-dsfr/Breadcrumb";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/guards";
import { getDossierComplet } from "@/lib/data";
import { AvisListe, AvisItem } from "@/components/AvisListe";

export const dynamic = "force-dynamic";

export default async function DeputeAmendementAvisPage({
  params
}: {
  params: { id: string; amendementId: string };
}) {
  await requireRole(["depute", "collaborateur"]);
  const dossier = await getDossierComplet(params.id);
  if (!dossier) notFound();

  const amendement = dossier.amendements.find((a) => a.id === params.amendementId);
  if (!amendement) notFound();

  // Côté député : on n'affiche pas les messages modérés (la modération
  // transparente reste consultable côté citoyen).
  const avis: AvisItem[] = dossier.commentaires
    .filter((c) => c.amendementId === amendement.id)
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

  return (
    <div className={fr.cx("fr-container", "fr-py-4w")}>
      <Breadcrumb
        currentPageLabel={`Avis — Amendement n°${amendement.numero}`}
        homeLinkProps={{ href: "/depute/dashboard" }}
        segments={[
          { label: "Tableau de bord", linkProps: { href: "/depute/dashboard" } },
          { label: dossier.titre, linkProps: { href: `/depute/dossier/${dossier.id}` } }
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
