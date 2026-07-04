import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import type { Source } from "@/lib/sources";

/**
 * Affiche les sources d'une sortie IA (ancrage documentaire systématique).
 * Sans source : badge gris « Non sourcé ».
 */
export function BadgeSource({ sources }: { sources?: Source[] | null }) {
  if (!sources || sources.length === 0) {
    return (
      <Badge severity="info" noIcon small>
        Non sourcé
      </Badge>
    );
  }
  return (
    <div className={fr.cx("fr-mt-1w")}>
      <p className={fr.cx("fr-text--sm", "fr-mb-1v")} style={{ fontWeight: 500 }}>
        <span className={fr.cx("fr-icon-links-line", "fr-icon--sm")} aria-hidden />{" "}
        Sources officielles
      </p>
      <ul className={fr.cx("fr-mb-0")} style={{ listStyle: "none", paddingLeft: 0 }}>
        {sources.map((s, i) => (
          <li key={i} className={fr.cx("fr-mb-1v")}>
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className={fr.cx("fr-link", "fr-link--sm")}
            >
              {s.titre}
            </a>
            {s.extrait ? (
              <span
                className={fr.cx("fr-text--xs")}
                style={{ display: "block", color: "var(--text-mention-grey)" }}
              >
                « {s.extrait} »
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
