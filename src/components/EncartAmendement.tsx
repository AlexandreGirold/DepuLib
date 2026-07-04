"use client";

import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { useState } from "react";
import { BadgeSource } from "./BadgeSource";
import { BandeauIA } from "./BandeauIA";
import type { Source } from "@/lib/sources";

/**
 * Encart de soutien (F1) : quand l'IA-juge trouve un amendement qui répond à la
 * préoccupation du citoyen (confiance ≥ 0,7), on l'affiche avec résumé sourcé et
 * un bouton « Soutenir cet amendement ».
 */
export function EncartAmendement({
  commentaireId,
  amendement,
  auto
}: {
  commentaireId: string;
  amendement: {
    id: string;
    numero: string;
    auteur: string;
    resumeIA: string;
    sourceUrl: string;
    sources?: Source[];
    upvotes: number;
  };
  auto?: boolean;
}) {
  const [soutenu, setSoutenu] = useState(false);
  const [upvotes, setUpvotes] = useState(amendement.upvotes);
  const [loading, setLoading] = useState(false);

  async function soutenir() {
    setLoading(true);
    try {
      const res = await fetch("/api/amendements/soutenir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentaireId, amendementId: amendement.id })
      });
      if (res.ok) {
        const data = await res.json();
        setSoutenu(true);
        setUpvotes(data.upvotes ?? upvotes + 1);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={fr.cx("fr-callout", "fr-callout--green-emeraude", "fr-mt-2w")}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Badge severity="new" small>
          Amendement en lien
        </Badge>
        {auto ? (
          <Badge severity="warning" small noIcon>
            Correspondance sémantique automatique
          </Badge>
        ) : null}
      </div>
      <h4 className={fr.cx("fr-callout__title", "fr-mt-1w", "fr-h6")}>
        L'amendement n°{amendement.numero} de {amendement.auteur} semble répondre à
        votre préoccupation
      </h4>
      <p className={fr.cx("fr-callout__text", "fr-text--sm")}>{amendement.resumeIA}</p>
      <BadgeSource
        sources={
          amendement.sources && amendement.sources.length > 0
            ? amendement.sources
            : [{ url: amendement.sourceUrl, titre: `Amendement n°${amendement.numero}` }]
        }
      />
      <div className={fr.cx("fr-mt-2w")} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          className={fr.cx("fr-btn", "fr-btn--sm")}
          onClick={soutenir}
          disabled={soutenu || loading}
        >
          {soutenu ? "✓ Vous soutenez cet amendement" : "Soutenir cet amendement"}
        </button>
        <span className={fr.cx("fr-text--sm")}>{upvotes} soutien(s)</span>
        <a
          href={amendement.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className={fr.cx("fr-link", "fr-link--sm")}
        >
          Lire le texte officiel
        </a>
      </div>
      <BandeauIA degrade={auto} />
    </div>
  );
}
