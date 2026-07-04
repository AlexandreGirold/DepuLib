import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { BadgeSource } from "./BadgeSource";
import type { Source } from "@/lib/sources";

export type AmendementView = {
  id: string;
  numero: string;
  auteur: string;
  resume: string;
  dispositif: string;
  sourceUrl: string;
  sources: Source[];
  upvotes: number;
  nbCommentaires: number;
  avisHref: string;
};

/**
 * Carte d'amendement — résumé IA sourcé + accès aux avis citoyens rattachés
 * (F5) quand des commentaires y sont liés + compteur de soutiens.
 */
export function AmendementCard({ a }: { a: AmendementView }) {
  return (
    <div
      className={fr.cx("fr-p-3w", "fr-mb-2w")}
      style={{ border: "1px solid var(--border-default-grey)", borderRadius: 8 }}
      id={`amendement-${a.id}`}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <h3 className={fr.cx("fr-h6", "fr-mb-1v")}>Amendement n°{a.numero}</h3>
        <Badge small noIcon severity="new">
          {a.upvotes} soutien(s)
        </Badge>
      </div>
      <p className={fr.cx("fr-text--sm", "fr-mb-1w")} style={{ color: "var(--text-mention-grey)" }}>
        {a.auteur}
      </p>
      <p className={fr.cx("fr-mb-1w")}>{a.resume}</p>
      <details>
        <summary className={fr.cx("fr-text--sm")} style={{ cursor: "pointer" }}>
          Voir le dispositif
        </summary>
        <p className={fr.cx("fr-text--sm", "fr-mt-1w")}>{a.dispositif}</p>
      </details>
      <BadgeSource sources={a.sources.length ? a.sources : [{ url: a.sourceUrl, titre: `Amendement n°${a.numero}` }]} />

      {a.nbCommentaires > 0 ? (
        <div className={fr.cx("fr-mt-2w")}>
          <Button
            priority="secondary"
            size="small"
            iconId="fr-icon-chat-3-line"
            linkProps={{ href: a.avisHref }}
          >
            Voir les {a.nbCommentaires} avis associé{a.nbCommentaires > 1 ? "s" : ""}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
