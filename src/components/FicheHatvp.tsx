import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";

export type OrganisationHatvp = {
  nomHatvp: string;
  numeroHatvp: string;
  secteur: string;
  description: string;
  lienHatvp: string;
};

/**
 * Fiche organisation HATVP complète (F6) — affichée sur la fiche RDV côté
 * député quand le demandeur est un représentant d'intérêts.
 */
export function FicheHatvp({ org }: { org: OrganisationHatvp }) {
  return (
    <div className={fr.cx("fr-callout", "fr-callout--blue-cumulus")}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Badge severity="info" small>
          Représentant d'intérêts vérifié HATVP
        </Badge>
        <span className={fr.cx("fr-text--xs")} style={{ color: "var(--text-mention-grey)" }}>
          N° {org.numeroHatvp}
        </span>
      </div>
      <h4 className={fr.cx("fr-callout__title", "fr-mt-1w")}>{org.nomHatvp}</h4>
      <p className={fr.cx("fr-text--sm", "fr-mb-1w")}>
        <strong>Secteur :</strong> {org.secteur}
      </p>
      <p className={fr.cx("fr-callout__text")}>{org.description}</p>
      <a
        href={org.lienHatvp}
        target="_blank"
        rel="noreferrer"
        className={fr.cx("fr-link")}
      >
        Consulter la fiche au répertoire HATVP
      </a>
    </div>
  );
}
