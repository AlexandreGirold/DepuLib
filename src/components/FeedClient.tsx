"use client";

import { fr } from "@codegouvfr/react-dsfr";
import { Tag } from "@codegouvfr/react-dsfr/Tag";
import { useState } from "react";
import { BandeauIA } from "./BandeauIA";

export type FeedItem = { titre: string; resume: string; lien: string; tag: string };

export function FeedClient({
  initialItems,
  hasFeed
}: {
  initialItems: FeedItem[];
  hasFeed: boolean;
}) {
  const [items, setItems] = useState<FeedItem[]>(initialItems);
  const [generated, setGenerated] = useState(hasFeed);
  const [loading, setLoading] = useState(false);

  async function generer() {
    setLoading(true);
    try {
      const res = await fetch("/api/feed", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
        setGenerated(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className={fr.cx("fr-btn", generated ? "fr-btn--secondary" : "fr-btn", "fr-mb-3w")}
        onClick={generer}
        disabled={loading}
      >
        {loading
          ? "Génération…"
          : generated
          ? "Régénérer mon résumé du mois"
          : "Générer mon résumé du mois"}
      </button>

      {items.length === 0 && !generated ? (
        <p>Cliquez ci-dessus pour générer votre résumé personnalisé du mois.</p>
      ) : items.length === 0 ? (
        <p>Aucune actualité pertinente pour le moment.</p>
      ) : (
        <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
          {items.map((it, i) => (
            <div key={i} className={fr.cx("fr-col-12")}>
              <div
                className={fr.cx("fr-p-3w", "fr-mb-2w")}
                style={{ border: "1px solid var(--border-default-grey)", borderRadius: 8 }}
              >
                <Tag small>{it.tag}</Tag>
                <h3 className={fr.cx("fr-h6", "fr-mt-1w", "fr-mb-1v")}>{it.titre}</h3>
                <p className={fr.cx("fr-mb-1w")}>{it.resume}</p>
                <a href={it.lien} target="_blank" rel="noreferrer" className={fr.cx("fr-link", "fr-link--sm")}>
                  Lire la source officielle
                </a>
              </div>
            </div>
          ))}
          <div className={fr.cx("fr-col-12")}>
            <BandeauIA />
          </div>
        </div>
      )}
    </div>
  );
}
