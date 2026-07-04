"use client";

import { fr } from "@codegouvfr/react-dsfr";
import { Tabs } from "@codegouvfr/react-dsfr/Tabs";
import { CommentForm } from "./CommentForm";
import { AvisListe, AvisItem } from "./AvisListe";
import { AmendementView } from "./AmendementCard";
import { AmendementsSearch } from "./AmendementsSearch";
import { BadgeSource } from "./BadgeSource";
import { BandeauIA } from "./BandeauIA";
import type { Source } from "@/lib/sources";

export function DossierTabs({
  dossierId,
  expose,
  resume,
  sourceUrl,
  amendements,
  avis
}: {
  dossierId: string;
  expose: string;
  resume: { resume: string; points_cles: string[]; sources: Source[] };
  sourceUrl: string;
  amendements: AmendementView[];
  avis: AvisItem[];
}) {
  return (
    <Tabs
      className={fr.cx("fr-mt-2w")}
      tabs={[
        {
          label: "Texte",
          content: (
            <div>
              <div className={fr.cx("fr-callout", "fr-callout--blue-ecume")}>
                <h2 className={fr.cx("fr-callout__title", "fr-h5")}>Résumé du dossier</h2>
                <p className={fr.cx("fr-callout__text")}>{resume.resume}</p>
                {resume.points_cles.length > 0 && (
                  <ul>
                    {resume.points_cles.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                )}
                <BadgeSource
                  sources={resume.sources.length ? resume.sources : [{ url: sourceUrl, titre: "Dossier législatif — Assemblée nationale" }]}
                />
                <BandeauIA />
              </div>
              <h3 className={fr.cx("fr-mt-3w")}>Exposé des motifs</h3>
              {expose.split("\n\n").map((par, i) => (
                <p key={i}>{par}</p>
              ))}
            </div>
          )
        },
        {
          label: `Amendements (${amendements.length})`,
          content: (
            <div>
              <p className={fr.cx("fr-text--sm")} style={{ color: "var(--text-mention-grey)" }}>
                Chaque amendement est résumé par l'IA et sourcé vers le texte officiel.
              </p>
              <AmendementsSearch amendements={amendements} />
            </div>
          )
        },
        {
          label: `Avis (${avis.filter((a) => a.moderationFlag === "ok").length})`,
          content: (
            <div>
              <CommentForm dossierId={dossierId} />
              <hr className={fr.cx("fr-mt-2w", "fr-mb-3w")} />
              <AvisListe initial={avis} />
            </div>
          )
        }
      ]}
    />
  );
}
