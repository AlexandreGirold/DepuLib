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

function sentimentBadge(s: number) {
  if (s > 0) return <Badge severity="success" small noIcon>Favorable</Badge>;
  if (s < 0) return <Badge severity="error" small noIcon>Défavorable</Badge>;
  return <Badge small noIcon>Nuancé</Badge>;
}

function Corps({ item, onUpvote, disabled }: { item: AvisItem; onUpvote: (id: string) => void; disabled: boolean }) {
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
    </>
  );
}

export function AvisListe({ initial }: { initial: AvisItem[] }) {
  const [items, setItems] = useState<AvisItem[]>(initial);
  const [tri, setTri] = useState<"soutiens" | "recents">("soutiens");
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

  const ok = sorted.filter((i) => i.moderationFlag === "ok");
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

      {ok.length === 0 && masques.length === 0 ? (
        <p>Aucun avis pour le moment. Soyez le premier à réagir.</p>
      ) : null}

      <ul style={{ listStyle: "none", paddingLeft: 0 }}>
        {ok.map((item) => (
          <li
            key={item.id}
            className={fr.cx("fr-p-2w", "fr-mb-2w")}
            style={{ border: "1px solid var(--border-default-grey)", borderRadius: 8 }}
          >
            <Corps item={item} onUpvote={upvote} disabled={pending === item.id} />
          </li>
        ))}
        {masques.map((item) => (
          <li key={item.id} className={fr.cx("fr-mb-2w")}>
            <CommentaireReplie flag={item.moderationFlag} motif={item.moderationMotif}>
              <Corps item={item} onUpvote={upvote} disabled={pending === item.id} />
            </CommentaireReplie>
          </li>
        ))}
      </ul>
    </div>
  );
}
