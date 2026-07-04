import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import Link from "next/link";
import { requireRole } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { moyenneSentiment, getCommissionForUser } from "@/lib/data";
import { JaugeSentiment } from "@/components/JaugeSentiment";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tableau de bord — Dépulib" };

export default async function DashboardPage() {
  const user = await requireRole(["depute", "collaborateur"]);
  const commission = await getCommissionForUser(user);

  const dossiers = await prisma.dossier.findMany({
    where: { commission },
    include: {
      commentaires: { select: { sentiment: true, moderationFlag: true } },
      amendements: {
        orderBy: { upvotes: "desc" },
        take: 3,
        select: { id: true, numero: true, auteur: true, upvotes: true }
      },
      _count: { select: { commentaires: true, amendements: true } }
    }
  });

  return (
    <div className={fr.cx("fr-container", "fr-py-4w")}>
      <h1>Tableau de bord</h1>
      <p className={fr.cx("fr-text--lead")}>
        {commission} — {dossiers.length} dossier(s) suivis. Vue d'ensemble des avis
        citoyens.
      </p>

      {dossiers.map((d) => {
        const { moyenne, count } = moyenneSentiment(d.commentaires);
        return (
          <div
            key={d.id}
            className={fr.cx("fr-p-4w", "fr-mb-3w")}
            style={{ border: "1px solid var(--border-default-grey)", borderRadius: 8 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <h2 className={fr.cx("fr-h4", "fr-mb-1w")}>
                <Link href={`/depute/dossier/${d.id}`} className={fr.cx("fr-link")}>
                  {d.titre}
                </Link>
              </h2>
              <Badge severity={d.statut.includes("séance") ? "warning" : "info"} small>
                {d.statut}
              </Badge>
            </div>

            <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters", "fr-mt-2w")}>
              <div className={fr.cx("fr-col-12", "fr-col-md-6")}>
                <p className={fr.cx("fr-text--sm", "fr-mb-1w")} style={{ fontWeight: 500 }}>
                  Sentiment global des avis
                </p>
                <JaugeSentiment value={moyenne} count={count} />
                <p className={fr.cx("fr-text--sm", "fr-mt-2w", "fr-mb-0")}>
                  <strong>{d._count.commentaires}</strong> message(s) reçu(s)
                </p>
              </div>
              <div className={fr.cx("fr-col-12", "fr-col-md-6")}>
                <p className={fr.cx("fr-text--sm", "fr-mb-1w")} style={{ fontWeight: 500 }}>
                  Top 3 amendements les plus soutenus
                </p>
                {d.amendements.length === 0 ? (
                  <p className={fr.cx("fr-text--sm")}>Aucun amendement.</p>
                ) : (
                  <ol className={fr.cx("fr-mb-0")}>
                    {d.amendements.map((a) => (
                      <li key={a.id}>
                        n°{a.numero} — {a.auteur}{" "}
                        <Badge small noIcon severity="new">
                          {a.upvotes} soutien(s)
                        </Badge>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>

            <div className={fr.cx("fr-mt-2w")}>
              <Link
                href={`/depute/dossier/${d.id}`}
                className={fr.cx("fr-btn", "fr-btn--secondary", "fr-btn--sm")}
              >
                Voir la synthèse détaillée et les avis
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
