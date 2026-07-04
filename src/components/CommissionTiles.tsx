"use client";

import { fr } from "@codegouvfr/react-dsfr";
import { Tile } from "@codegouvfr/react-dsfr/Tile";
import { useMemo, useState } from "react";

export type CommissionInfo = { commission: string; count: number };

/** Pictogramme DSFR + libellé court selon le nom de la commission. */
function meta(nom: string): { picto: string; court: string } {
  const n = nom.toLowerCase();
  if (n.includes("lois"))
    return { picto: "institutions/justice.svg", court: "Lois" };
  if (n.includes("sociales"))
    return { picto: "health/health.svg", court: "Affaires sociales" };
  if (n.includes("culturelles"))
    return { picto: "leisure/culture.svg", court: "Affaires culturelles et éducation" };
  if (n.includes("développement") || n.includes("developpement"))
    return { picto: "environment/leaf.svg", court: "Développement durable" };
  if (n.includes("économiques") || n.includes("economiques"))
    return { picto: "buildings/factory.svg", court: "Affaires économiques" };
  if (n.includes("finances"))
    return { picto: "institutions/money.svg", court: "Finances" };
  if (n.includes("défense") || n.includes("defense"))
    return { picto: "institutions/gendarmerie.svg", court: "Défense nationale" };
  if (n.includes("étrangères") || n.includes("etrangeres"))
    return { picto: "map/map.svg", court: "Affaires étrangères" };
  return { picto: "document/document.svg", court: nom.replace("Commission ", "") };
}

export function CommissionTiles({ commissions }: { commissions: CommissionInfo[] }) {
  const [q, setQ] = useState("");

  const filtres = useMemo(() => {
    const norm = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const query = norm(q.trim());
    return commissions
      .map((c) => ({ ...c, ...meta(c.commission) }))
      .filter((c) => !query || norm(c.court).includes(query) || norm(c.commission).includes(query));
  }, [commissions, q]);

  return (
    <div>
      <div className={fr.cx("fr-mb-4w")}>
        <div className={fr.cx("fr-search-bar")} role="search" style={{ maxWidth: 560 }}>
          <label className={fr.cx("fr-label")} htmlFor="recherche-commission">
            Rechercher une commission
          </label>
          <input
            id="recherche-commission"
            className={fr.cx("fr-input")}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ex. lois, affaires sociales, finances…"
          />
          <button type="button" className={fr.cx("fr-btn")} title="Rechercher">
            Rechercher
          </button>
        </div>
      </div>

      <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
        {filtres.map((c) => (
          <div key={c.commission} className={fr.cx("fr-col-12", "fr-col-sm-6", "fr-col-md-4")}>
            <Tile
              title={c.court}
              desc={`${c.count} dossier${c.count > 1 ? "s" : ""} en discussion`}
              orientation="vertical"
              imageUrl={`/dsfr/artwork/pictograms/${c.picto}`}
              imageSvg
              imageAlt=""
              linkProps={{
                href: `/citoyen?commission=${encodeURIComponent(c.commission)}`
              }}
              enlargeLinkOrButton
            />
          </div>
        ))}
        {filtres.length === 0 && (
          <div className={fr.cx("fr-col-12")}>
            <p>Aucune commission ne correspond à « {q} ».</p>
          </div>
        )}
      </div>
    </div>
  );
}
