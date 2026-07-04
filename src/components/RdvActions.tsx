"use client";

import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Actions accepter / refuser un RDV. Désactivées pour le collaborateur (F10),
 * avec tooltip explicatif.
 */
export function RdvActions({
  rdvId,
  statut,
  canAct
}: {
  rdvId: string;
  statut: string;
  canAct: boolean;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(statut);
  const [loading, setLoading] = useState(false);

  async function agir(nouveau: "accepte" | "refuse") {
    setLoading(true);
    try {
      const res = await fetch("/api/rdv/statut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rdvId, statut: nouveau })
      });
      if (res.ok) {
        setCurrent(nouveau);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  const label: Record<string, { t: string; s: any }> = {
    demande: { t: "En attente de décision", s: "info" },
    accepte: { t: "Rendez-vous accepté", s: "success" },
    refuse: { t: "Rendez-vous refusé", s: "error" }
  };
  const cur = label[current] ?? label.demande;

  return (
    <div>
      <p>
        <Badge severity={cur.s}>{cur.t}</Badge>
      </p>
      <div className={fr.cx("fr-btns-group", "fr-btns-group--inline-md")}>
        <button
          type="button"
          className={fr.cx("fr-btn")}
          disabled={!canAct || loading || current === "accepte"}
          onClick={() => agir("accepte")}
          title={!canAct ? "Action réservée à la députée (accès collaborateur en lecture)" : undefined}
        >
          Accepter
        </button>
        <button
          type="button"
          className={fr.cx("fr-btn", "fr-btn--secondary")}
          disabled={!canAct || loading || current === "refuse"}
          onClick={() => agir("refuse")}
          title={!canAct ? "Action réservée à la députée (accès collaborateur en lecture)" : undefined}
        >
          Refuser
        </button>
      </div>
      {!canAct && (
        <p className={fr.cx("fr-text--xs", "fr-mt-1w")} style={{ color: "var(--text-mention-grey)" }}>
          En tant que collaborateur, vous consultez ce rendez-vous mais ne pouvez pas
          l'accepter ni le refuser.
        </p>
      )}
    </div>
  );
}
