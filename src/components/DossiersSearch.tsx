"use client";

import { fr } from "@codegouvfr/react-dsfr";
import { Card } from "@codegouvfr/react-dsfr/Card";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { useMemo, useState } from "react";

export type DossierListItem = {
  id: string;
  titre: string;
  numero: string;
  statut: string;
  extrait: string;
  amendements: number;
  commentaires: number;
};

const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function DossiersSearch({ dossiers }: { dossiers: DossierListItem[] }) {
  const [q, setQ] = useState("");

  const filtres = useMemo(() => {
    const query = norm(q.trim());
    if (!query) return dossiers;
    return dossiers.filter((d) => {
      const hay = norm([d.titre, d.numero, d.statut, d.extrait].join(" "));
      return query.split(/\s+/).every((mot) => hay.includes(mot));
    });
  }, [dossiers, q]);

  return (
    <div>
      <div className={fr.cx("fr-search-bar", "fr-mb-2w")} role="search" style={{ maxWidth: 560 }}>
        <label className={fr.cx("fr-label")} htmlFor="recherche-loi">
          Rechercher une loi
        </label>
        <input
          id="recherche-loi"
          className={fr.cx("fr-input")}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Titre, numéro, mot-clé…"
        />
        <button type="button" className={fr.cx("fr-btn")} title="Rechercher">
          Rechercher
        </button>
      </div>

      <p className={fr.cx("fr-text--sm")} style={{ color: "var(--text-mention-grey)" }}>
        {filtres.length} dossier{filtres.length > 1 ? "s" : ""}
        {q ? ` correspondant à « ${q} »` : " en discussion"} — données open data de
        l'Assemblée nationale (17e législature).
      </p>

      <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters", "fr-mt-1w")}>
        {filtres.map((d) => (
          <div key={d.id} className={fr.cx("fr-col-12", "fr-col-md-6")}>
            <Card
              title={d.titre}
              linkProps={{ href: `/citoyen/dossier/${d.id}` }}
              desc={d.extrait}
              start={
                <ul className={fr.cx("fr-badges-group")}>
                  <li>
                    <Badge severity="info" small noIcon>
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
                  {d.amendements} amendements · {d.commentaires} avis
                </p>
              }
              enlargeLink
            />
          </div>
        ))}
        {filtres.length === 0 && (
          <div className={fr.cx("fr-col-12")}>
            <p>Aucune loi ne correspond à « {q} » dans cette commission.</p>
          </div>
        )}
      </div>
    </div>
  );
}
