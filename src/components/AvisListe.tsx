"use client";

import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { useMemo, useState } from "react";
import { CommentaireReplie } from "./CommentaireReplie";

export type AvisItem = {
  id: string;
  texte: string;
  sentiment: number;
  moderationFlag: string;
  moderationMotif?: string | null;
  upvotes: number;
  hasUpvoted: boolean;
  author: string;
  amendementNumero?: string | null;
  createdAt: string;
};

// Filtres par sentiment — couleurs alignées sur les badges (favorable=success,
// défavorable=error, nuancé=grey).
const FILTRES_SENTIMENT = [
  { key: "positif", label: "Favorables", dsfr: "success" },
  { key: "negatif", label: "Défavorables", dsfr: "error" },
  { key: "neutre", label: "Nuancés", dsfr: "grey" }
] as const;

function sentimentBadge(s: number) {
  if (s > 0) return <Badge severity="success" small noIcon>Favorable</Badge>;
  if (s < 0) return <Badge severity="error" small noIcon>Défavorable</Badge>;
  return <Badge small noIcon>Nuancé</Badge>;
}

function Corps({
  item,
  onUpvote,
  disabled,
  canUpvote
}: {
  item: AvisItem;
  onUpvote: (id: string) => void;
  disabled: boolean;
  canUpvote: boolean;
}) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <strong>{item.author}</strong>
        {item.moderationFlag === "ok" ? sentimentBadge(item.sentiment) : null}
      </div>
      <p className={fr.cx("fr-mt-1w", "fr-mb-1w")}>{item.texte}</p>
      {item.amendementNumero ? (
        <p className={fr.cx("fr-text--xs", "fr-mb-1w")}>
          <span className={fr.cx("fr-icon-links-line", "fr-icon--xs")} aria-hidden /> Rattaché à
          l'amendement n°{item.amendementNumero}
        </p>
      ) : null}
      {canUpvote ? (
        <button
          type="button"
          className={fr.cx(
            "fr-btn",
            "fr-btn--sm",
            item.hasUpvoted ? "fr-btn--secondary" : "fr-btn--tertiary"
          )}
          onClick={() => onUpvote(item.id)}
          disabled={disabled || item.hasUpvoted}
        >
          <span className={fr.cx("fr-icon-thumb-up-line", "fr-icon--sm")} aria-hidden />{" "}
          {item.hasUpvoted ? "Soutenu" : "Soutenir"} · {item.upvotes}
        </button>
      ) : (
        <p className={fr.cx("fr-text--sm", "fr-mb-0")} style={{ color: "var(--text-mention-grey)" }}>
          <span className={fr.cx("fr-icon-thumb-up-line", "fr-icon--sm")} aria-hidden />{" "}
          {item.upvotes} soutien(s)
        </p>
      )}
    </>
  );
}

type FiltreSentiment = "tous" | "positif" | "negatif" | "neutre";

export function AvisListe({
  initial,
  canUpvote = true,
  showSentimentFilter = false
}: {
  initial: AvisItem[];
  canUpvote?: boolean;
  showSentimentFilter?: boolean;
}) {
  const [items, setItems] = useState<AvisItem[]>(initial);
  const [tri, setTri] = useState<"soutiens" | "recents">("soutiens");
  const [filtreSentiment, setFiltreSentiment] = useState<FiltreSentiment>("tous");
  const [pending, setPending] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const arr = [...items];
    if (tri === "soutiens") arr.sort((a, b) => b.upvotes - a.upvotes);
    else arr.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return arr;
  }, [items, tri]);

  async function upvote(id: string) {
    if (pending) return;
    setPending(id);
    // Optimiste + protection double-clic (bouton désactivé + garde serveur)
    try {
      const res = await fetch("/api/commentaires/upvote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentaireId: id })
      });
      if (res.ok) {
        const data = await res.json();
        setItems((prev) =>
          prev.map((it) =>
            it.id === id ? { ...it, upvotes: data.upvotes, hasUpvoted: true } : it
          )
        );
      }
    } finally {
      setPending(null);
    }
  }

  const parSentiment = (i: AvisItem) => {
    if (filtreSentiment === "positif") return i.sentiment > 0;
    if (filtreSentiment === "negatif") return i.sentiment < 0;
    if (filtreSentiment === "neutre") return i.sentiment === 0;
    return true;
  };

  const ok = sorted.filter((i) => i.moderationFlag === "ok" && parSentiment(i));
  const masques = sorted.filter((i) => i.moderationFlag !== "ok");

  return (
    <div>
      <div className={fr.cx("fr-mb-2w")} style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span className={fr.cx("fr-text--sm")}>Trier par :</span>
        <button
          type="button"
          className={fr.cx("fr-btn", "fr-btn--sm", ...(tri === "soutiens" ? [] : (["fr-btn--tertiary"] as const)))}
          onClick={() => setTri("soutiens")}
        >
          Plus soutenus
        </button>
        <button
          type="button"
          className={fr.cx("fr-btn", "fr-btn--sm", ...(tri === "recents" ? [] : (["fr-btn--tertiary"] as const)))}
          onClick={() => setTri("recents")}
        >
          Plus récents
        </button>
      </div>

      {showSentimentFilter && (
        <div className={fr.cx("fr-mb-2w")} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className={fr.cx("fr-text--sm")}>Filtrer :</span>
          {FILTRES_SENTIMENT.map((f) => {
            const actif = filtreSentiment === f.key;
            return (
              <button
                key={f.key}
                type="button"
                className={fr.cx("fr-btn", "fr-btn--sm", "fr-btn--tertiary")}
                aria-pressed={actif}
                onClick={() => setFiltreSentiment((prev) => (prev === f.key ? "tous" : f.key))}
                style={{
                  color: `var(--text-default-${f.dsfr})`,
                  backgroundColor: actif ? `var(--background-contrast-${f.dsfr})` : "transparent",
                  boxShadow: `inset 0 0 0 1px var(--text-default-${f.dsfr})`
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      )}

      {ok.length === 0 && masques.length === 0 ? (
        filtreSentiment === "tous" ? (
          <p>Aucun avis pour le moment. Soyez le premier à réagir.</p>
        ) : (
          <p>Aucun avis ne correspond à ce filtre.</p>
        )
      ) : null}

      <ul style={{ listStyle: "none", paddingLeft: 0 }}>
        {ok.map((item) => (
          <li
            key={item.id}
            className={fr.cx("fr-p-2w", "fr-mb-2w")}
            style={{ border: "1px solid var(--border-default-grey)", borderRadius: 8 }}
          >
            <Corps item={item} onUpvote={upvote} disabled={pending === item.id} canUpvote={canUpvote} />
          </li>
        ))}
        {masques.map((item) => (
          <li key={item.id} className={fr.cx("fr-mb-2w")}>
            <CommentaireReplie flag={item.moderationFlag} motif={item.moderationMotif}>
              <Corps item={item} onUpvote={upvote} disabled={pending === item.id} canUpvote={canUpvote} />
            </CommentaireReplie>
          </li>
        ))}
      </ul>
    </div>
  );
}
