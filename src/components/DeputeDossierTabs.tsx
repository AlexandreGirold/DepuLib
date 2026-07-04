"use client";

import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { Tabs } from "@codegouvfr/react-dsfr/Tabs";
import { SyntheseCard, SyntheseData } from "./SyntheseCard";
import { AvisListe, AvisItem } from "./AvisListe";
import { AmendementCard, AmendementView } from "./AmendementCard";
import { BadgeSource } from "./BadgeSource";
import type { Source } from "@/lib/sources";

export type ContributionView = {
  id: string;
  auteur: string;
  organisation: string | null;
  position: string;
  argumentaire: string;
  resumeIA: string | null;
  sources: Source[];
  documents: { id: string; filename: string; resumeIA: string | null }[];
};

const POSITION_LABEL: Record<string, string> = {
  favorable: "Favorable",
  defavorable: "Défavorable",
  amendement: "Amendement souhaité"
};

export function DeputeDossierTabs({
  dossierId,
  synthese,
  avis,
  amendements,
  contributions
}: {
  dossierId: string;
  synthese: SyntheseData;
  avis: AvisItem[];
  amendements: AmendementView[];
  contributions: ContributionView[];
}) {
  return (
    <Tabs
      className={fr.cx("fr-mt-2w")}
      tabs={[
        {
          label: `Synthèse & avis (${avis.filter((a) => a.moderationFlag === "ok").length})`,
          content: (
            <div>
              <SyntheseCard dossierId={dossierId} initial={synthese} />
              <h3 className={fr.cx("fr-mt-3w")}>Avis citoyens</h3>
              <AvisListe initial={avis} />
            </div>
          )
        },
        {
          label: `Amendements (${amendements.length})`,
          content: (
            <div>
              <p className={fr.cx("fr-text--sm")} style={{ color: "var(--text-mention-grey)" }}>
                Sentiment citoyen propre à chaque amendement ayant reçu des avis.
              </p>
              {amendements.map((a) => (
                <AmendementCard key={a.id} a={a} />
              ))}
            </div>
          )
        },
        {
          label: `Contributions des représentants d'intérêts (${contributions.length})`,
          content: (
            <div>
              <p className={fr.cx("fr-text--sm")} style={{ color: "var(--text-mention-grey)" }}>
                Contributions déposées par des représentants d'intérêts inscrits à la
                HATVP — clairement séparées des avis citoyens.
              </p>
              {contributions.length === 0 ? (
                <p>Aucune contribution de représentant d'intérêts sur ce dossier.</p>
              ) : (
                contributions.map((c) => (
                  <div
                    key={c.id}
                    className={fr.cx("fr-p-3w", "fr-mb-2w")}
                    style={{ border: "1px solid var(--border-default-grey)", borderRadius: 8 }}
                  >
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <Badge severity="info" small>
                        Représentant d'intérêts vérifié HATVP
                      </Badge>
                      <Badge
                        small
                        noIcon
                        severity={
                          c.position === "favorable"
                            ? "success"
                            : c.position === "defavorable"
                            ? "error"
                            : "new"
                        }
                      >
                        {POSITION_LABEL[c.position] ?? c.position}
                      </Badge>
                    </div>
                    <p className={fr.cx("fr-mt-1w", "fr-mb-1v")}>
                      <strong>{c.auteur}</strong>
                      {c.organisation ? ` — ${c.organisation}` : ""}
                    </p>
                    <p className={fr.cx("fr-mb-1w")}>{c.argumentaire}</p>
                    {c.resumeIA && (
                      <div className={fr.cx("fr-mt-1w")}>
                        <p className={fr.cx("fr-text--sm", "fr-mb-1v")} style={{ fontWeight: 500 }}>
                          Résumé IA de la contribution
                        </p>
                        <p className={fr.cx("fr-text--sm")}>{c.resumeIA}</p>
                      </div>
                    )}
                    {c.documents.length > 0 && (
                      <div className={fr.cx("fr-mt-1w")}>
                        <p className={fr.cx("fr-text--sm", "fr-mb-1v")} style={{ fontWeight: 500 }}>
                          Documents justificatifs
                        </p>
                        <ul className={fr.cx("fr-mb-0")}>
                          {c.documents.map((doc) => (
                            <li key={doc.id} className={fr.cx("fr-text--sm")}>
                              {doc.filename}
                              {doc.resumeIA ? ` — ${doc.resumeIA}` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <BadgeSource sources={c.sources} />
                  </div>
                ))
              )}
            </div>
          )
        }
      ]}
    />
  );
}
