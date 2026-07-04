"use client";

import { fr } from "@codegouvfr/react-dsfr";
import { useMemo, useState } from "react";
import { AmendementCard, AmendementView } from "./AmendementCard";

const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Liste des amendements avec recherche plein texte (numéro, auteur, article,
 * dispositif, exposé sommaire, résumé).
 */
export function AmendementsSearch({ amendements }: { amendements: AmendementView[] }) {
  const [q, setQ] = useState("");

  const filtres = useMemo(() => {
    const query = norm(q.trim());
    if (!query) return amendements;
    return amendements.filter((a) => {
      const hay = norm(
        [a.numero, a.auteur, a.article ?? "", a.sort ?? "", a.resume, a.dispositif].join(" ")
      );
      return query.split(/\s+/).every((mot) => hay.includes(mot));
    });
  }, [amendements, q]);

  return (
    <div>
      <div className={fr.cx("fr-search-bar", "fr-mb-3w")} role="search" style={{ maxWidth: 560 }}>
        <label className={fr.cx("fr-label")} htmlFor="recherche-amendement">
          Rechercher un amendement
        </label>
        <input
          id="recherche-amendement"
          className={fr.cx("fr-input")}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Mot-clé, auteur, n° d'amendement, article…"
        />
        <button type="button" className={fr.cx("fr-btn")} title="Rechercher">
          Rechercher
        </button>
      </div>

      <p className={fr.cx("fr-text--sm")} style={{ color: "var(--text-mention-grey)" }}>
        {filtres.length} amendement{filtres.length > 1 ? "s" : ""}
        {q ? ` correspondant à « ${q} »` : ""}
      </p>

      {filtres.map((a) => (
        <AmendementCard key={a.id} a={a} />
      ))}
      {filtres.length === 0 && <p>Aucun amendement ne correspond à votre recherche.</p>}
    </div>
  );
}
