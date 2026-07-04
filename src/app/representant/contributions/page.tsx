import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { requireRole } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { ContributionForm } from "@/components/ContributionForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mes contributions — Dépulib" };

const POSITION_LABEL: Record<string, string> = {
  favorable: "Favorable",
  defavorable: "Défavorable",
  amendement: "Amendement souhaité"
};

export default async function ContributionsPage() {
  const user = await requireRole(["representant"]);
  const dossiers = await prisma.dossier.findMany({
    orderBy: { titre: "asc" },
    select: { id: true, titre: true }
  });
  const mesContribs = await prisma.contribution.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { dossier: { select: { titre: true } }, documents: true }
  });

  return (
    <div className={fr.cx("fr-container", "fr-py-4w")}>
      <h1>Contributions sur les textes en discussion</h1>
      <p className={fr.cx("fr-text--lead")}>
        Déposez un avis structuré sur un dossier. Vos contributions apparaissent
        côté député dans un onglet dédié, clairement distinct des avis citoyens, avec
        votre badge HATVP.
      </p>

      <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
        <div className={fr.cx("fr-col-12", "fr-col-md-7")}>
          <ContributionForm dossiers={dossiers} />
        </div>
        <div className={fr.cx("fr-col-12", "fr-col-md-5")}>
          <h2 className={fr.cx("fr-h5")}>Mes contributions déposées</h2>
          {mesContribs.length === 0 ? (
            <p className={fr.cx("fr-text--sm")}>Aucune contribution pour le moment.</p>
          ) : (
            mesContribs.map((c) => (
              <div
                key={c.id}
                className={fr.cx("fr-p-2w", "fr-mb-2w")}
                style={{ border: "1px solid var(--border-default-grey)", borderRadius: 8 }}
              >
                <Badge small noIcon severity={c.position === "favorable" ? "success" : c.position === "defavorable" ? "error" : "new"}>
                  {POSITION_LABEL[c.position]}
                </Badge>
                <p className={fr.cx("fr-text--sm", "fr-mt-1w", "fr-mb-1v")}>
                  <strong>{c.dossier.titre}</strong>
                </p>
                <p className={fr.cx("fr-text--sm", "fr-mb-0")}>{c.argumentaire.slice(0, 140)}…</p>
                {c.documents.length > 0 && (
                  <p className={fr.cx("fr-text--xs", "fr-mt-1v", "fr-mb-0")}>
                    📎 {c.documents.length} document(s) joint(s)
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
