"use client";

import { fr } from "@codegouvfr/react-dsfr";
import { useState } from "react";

const MOTIF_LABEL: Record<string, string> = {
  insultant: "propos injurieux",
  hors_sujet: "hors sujet",
  propagande: "propagande"
};

/**
 * Modération transparente (fil rouge n°3) : un message flaggé n'est jamais
 * supprimé, il est REPLIÉ avec son motif visible, et reste consultable au clic.
 */
export function CommentaireReplie({
  flag,
  motif,
  children
}: {
  flag: string;
  motif?: string | null;
  children: React.ReactNode;
}) {
  const [ouvert, setOuvert] = useState(false);
  const label = MOTIF_LABEL[flag] ?? "contenu signalé";

  return (
    <div
      className={fr.cx("fr-p-2w")}
      style={{
        border: "1px dashed var(--border-default-grey)",
        borderRadius: 8,
        background: "var(--background-alt-grey)"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className={fr.cx("fr-icon-eye-off-line", "fr-icon--sm")} aria-hidden />
        <span className={fr.cx("fr-text--sm")}>
          Masqué : {label}
          {motif ? ` — ${motif}` : ""}
        </span>
        <button
          type="button"
          className={fr.cx("fr-btn", "fr-btn--tertiary-no-outline", "fr-btn--sm")}
          onClick={() => setOuvert((o) => !o)}
          aria-expanded={ouvert}
        >
          {ouvert ? "Masquer" : "Afficher quand même"}
        </button>
      </div>
      {ouvert && <div className={fr.cx("fr-mt-2w")}>{children}</div>}
    </div>
  );
}
