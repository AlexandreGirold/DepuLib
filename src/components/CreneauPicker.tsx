"use client";

import { fr } from "@codegouvfr/react-dsfr";
import { useEffect, useState } from "react";

type Creneau = { id: string; debut: string; fin: string };

const formatJour = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const formatHeure = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function CreneauPicker({
  deputeId,
  value,
  onChange
}: {
  deputeId: string;
  value: string | null;
  onChange: (creneauId: string, debut: string) => void;
}) {
  const [creneaux, setCreneaux] = useState<Creneau[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    setCreneaux(null);
    setErreur(null);
    fetch(`/api/deputes/${deputeId}/creneaux`)
      .then((res) => res.json())
      .then((data) => {
        if (annule) return;
        if (data.ok) setCreneaux(data.creneaux);
        else setErreur(data.error ?? "Erreur de chargement des créneaux");
      })
      .catch(() => {
        if (!annule) setErreur("Erreur réseau lors du chargement des créneaux");
      });
    return () => {
      annule = true;
    };
  }, [deputeId]);

  if (erreur) {
    return (
      <p className={fr.cx("fr-text--sm")} style={{ color: "var(--text-default-error)" }}>
        {erreur}
      </p>
    );
  }

  if (creneaux === null) {
    return (
      <p className={fr.cx("fr-text--sm")} style={{ color: "var(--text-mention-grey)" }}>
        Chargement des disponibilités du député…
      </p>
    );
  }

  if (creneaux.length === 0) {
    return (
      <p className={fr.cx("fr-text--sm")} style={{ color: "var(--text-mention-grey)" }}>
        Aucun créneau disponible pour ce député actuellement.
      </p>
    );
  }

  const parJour = new Map<string, Creneau[]>();
  for (const c of creneaux) {
    const jour = capitalise(formatJour.format(new Date(c.debut)));
    const liste = parJour.get(jour) ?? [];
    liste.push(c);
    parJour.set(jour, liste);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {[...parJour.entries()].map(([jour, creneauxDuJour]) => (
        <div key={jour}>
          <p className={fr.cx("fr-text--sm", "fr-mb-1w")} style={{ fontWeight: 500 }}>
            {jour}
          </p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {creneauxDuJour.map((c) => {
              const selectionne = value === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onChange(c.id, c.debut)}
                  aria-pressed={selectionne}
                  className={fr.cx("fr-btn", selectionne ? undefined : "fr-btn--secondary")}
                >
                  {formatHeure.format(new Date(c.debut))}–{formatHeure.format(new Date(c.fin))}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
