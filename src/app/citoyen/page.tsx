import { fr } from "@codegouvfr/react-dsfr";
import { Card } from "@codegouvfr/react-dsfr/Card";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { getDossiers } from "@/lib/data";
import { requireRole } from "@/lib/guards";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dossiers en débat — Dépulib" };

export default async function CitoyenHome() {
  const user = await requireRole(["citoyen"]);
  const dossiers = await getDossiers();

  return (
    <div className={fr.cx("fr-container", "fr-py-4w")}>
      <h1>Dossiers à l'ordre du jour</h1>
      <p className={fr.cx("fr-text--lead")}>
        Bonjour {user.displayName}. Choisissez un dossier pour le comprendre et
        donner votre avis. L'IA reliera votre message à l'amendement concerné.
      </p>

      <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters", "fr-mt-2w")}>
        {dossiers.map((d) => (
          <div key={d.id} className={fr.cx("fr-col-12", "fr-col-md-6")}>
            <Card
              title={d.titre}
              linkProps={{ href: `/citoyen/dossier/${d.id}` }}
              desc={d.expose.slice(0, 180).replace(/\s+\S*$/, "") + "…"}
              start={
                <ul className={fr.cx("fr-badges-group")}>
                  <li>
                    <Badge severity={d.statut.includes("séance") ? "warning" : "info"} small noIcon>
                      {d.statut}
                    </Badge>
                  </li>
                  <li>
                    <Badge small noIcon>{d.numero}</Badge>
                  </li>
                </ul>
              }
              end={
                <p className={fr.cx("fr-text--sm", "fr-mb-0")} style={{ color: "var(--text-mention-grey)" }}>
                  {d.commission} · {d._count.amendements} amendements ·{" "}
                  {d._count.commentaires} avis
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
