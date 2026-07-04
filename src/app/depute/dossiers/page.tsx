import { fr } from "@codegouvfr/react-dsfr";
import { Card } from "@codegouvfr/react-dsfr/Card";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { requireRole } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { getCommissionForUser } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dossiers — Dépulib" };

export default async function DeputeDossiers() {
  const user = await requireRole(["depute", "collaborateur"]);
  const commission = await getCommissionForUser(user);
  const dossiers = await prisma.dossier.findMany({
    where: { commission },
    orderBy: { titre: "asc" },
    include: { _count: { select: { amendements: true, commentaires: true } } }
  });

  return (
    <div className={fr.cx("fr-container", "fr-py-4w")}>
      <h1>Dossiers — {commission}</h1>
      <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters", "fr-mt-2w")}>
        {dossiers.map((d) => (
          <div key={d.id} className={fr.cx("fr-col-12", "fr-col-md-6")}>
            <Card
              title={d.titre}
              linkProps={{ href: `/depute/dossier/${d.id}` }}
              desc={d.expose.slice(0, 160).replace(/\s+\S*$/, "") + "…"}
              start={
                <ul className={fr.cx("fr-badges-group")}>
                  <li>
                    <Badge severity={d.statut.includes("séance") ? "warning" : "info"} small noIcon>
                      {d.statut}
                    </Badge>
                  </li>
                </ul>
              }
              end={
                <p className={fr.cx("fr-text--sm", "fr-mb-0")} style={{ color: "var(--text-mention-grey)" }}>
                  {d._count.amendements} amendements · {d._count.commentaires} avis
                </p>
              }
              enlargeLink
            />
          </div>
        ))}
      </div>
    </div>
  );
}
