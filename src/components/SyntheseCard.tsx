"use client";

import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { useState } from "react";
import { BadgeSource } from "./BadgeSource";
import { BandeauIA } from "./BandeauIA";
import type { Source } from "@/lib/sources";

export type SyntheseData = {
  synthese: string;
  verbatims: string[];
  repartition: { pour: number; contre: number; nuance: number };
  sources: Source[];
};

export function SyntheseCard({
  dossierId,
  initial
}: {
  dossierId: string;
  initial: SyntheseData;
}) {
  const [data, setData] = useState<SyntheseData>(initial);
  const [loading, setLoading] = useState(false);

  async function regen() {
    setLoading(true);
    try {
      const res = await fetch("/api/synthese", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dossierId })
      });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  const { pour, contre, nuance } = data.repartition;

  return (
    <div className={fr.cx("fr-callout", "fr-callout--blue-ecume")}>
      <h2 className={fr.cx("fr-callout__title", "fr-h5")}>Synthèse des avis citoyens</h2>

      <div className={fr.cx("fr-mb-2w")} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Badge severity="success" small noIcon>
          {pour} favorable(s)
        </Badge>
        <Badge severity="error" small noIcon>
          {contre} défavorable(s)
        </Badge>
        <Badge small noIcon>
          {nuance} nuancé(s)
        </Badge>
      </div>

      <p className={fr.cx("fr-callout__text")}>{data.synthese}</p>

      {data.verbatims.length > 0 && (
        <div className={fr.cx("fr-mt-2w")}>
          <p className={fr.cx("fr-text--sm")} style={{ fontWeight: 500 }}>
            Verbatims cités (présents mot pour mot dans les avis) :
          </p>
          <ul>
            {data.verbatims.map((v, i) => (
              <li key={i}>
                <em>« {v} »</em>
              </li>
            ))}
          </ul>
        </div>
      )}

      <BadgeSource sources={data.sources} />

      <div className={fr.cx("fr-mt-2w")}>
        <button
          type="button"
          className={fr.cx("fr-btn", "fr-btn--secondary", "fr-btn--sm")}
          onClick={regen}
          disabled={loading}
        >
          {loading ? "Génération…" : "Régénérer la synthèse"}
        </button>
      </div>

      <BandeauIA />
    </div>
  );
}
