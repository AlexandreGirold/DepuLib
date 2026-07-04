import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { JaugeSentiment } from "./JaugeSentiment";
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
  sentimentMoyen: number;
  nbCommentaires: number;
};

/**
 * Carte d'amendement — résumé IA sourcé + mini-jauge de sentiment propre (F5)
 * quand des commentaires y sont liés + compteur de soutiens.
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
          <p className={fr.cx("fr-text--sm", "fr-mb-1v")} style={{ fontWeight: 500 }}>
            Sentiment citoyen sur cet amendement
          </p>
          <JaugeSentiment value={a.sentimentMoyen} count={a.nbCommentaires} compact />
        </div>
      ) : null}
    </div>
  );
}
