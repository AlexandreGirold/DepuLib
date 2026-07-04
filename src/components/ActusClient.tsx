"use client";

import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BandeauIA } from "./BandeauIA";
import {
  Actu,
  periodeLabel,
  topicBorderVar,
  topicTextVar,
  topicVar
} from "@/lib/actus";

// createModal doit être appelé au niveau module (enregistrement DSFR).
const detailModal = createModal({ id: "actu-detail", isOpenedByDefault: false });
const moisModal = createModal({ id: "actu-mois", isOpenedByDefault: false });

export type ActuGroup = { topic: string; items: Actu[] };

const BASE_PATH = "/citoyen/quoi-de-neuf";

export function ActusClient({
  groups,
  selectedPeriode,
  currentPeriode,
  months,
  prevPeriode
}: {
  groups: ActuGroup[];
  selectedPeriode: string;
  currentPeriode: string;
  months: string[];
  prevPeriode: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Actu | null>(null);

  const isCurrent = selectedPeriode === currentPeriode;

  function goTo(periode: string) {
    router.push(periode === currentPeriode ? BASE_PATH : `${BASE_PATH}?periode=${periode}`);
  }

  function openDetail(a: Actu) {
    setSelected(a);
    detailModal.open();
  }

  return (
    <div>
      {groups.length === 0 ? (
        <p className={fr.cx("fr-mt-2w")}>
          Aucune actualité disponible pour {periodeLabel(selectedPeriode)}.
        </p>
      ) : (
        groups.map((g) => (
          <section
            key={g.topic}
            className={fr.cx("fr-mb-5w")}
            style={{ borderLeft: `4px solid ${topicBorderVar(g.topic)}`, paddingLeft: 16 }}
          >
            <span
              className={fr.cx("fr-text--sm", "fr-mb-2w")}
              style={{
                display: "inline-block",
                background: topicVar(g.topic),
                color: topicTextVar(g.topic),
                fontWeight: 700,
                padding: "4px 12px",
                borderRadius: 4
              }}
            >
              {g.topic}
            </span>
            <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
              {g.items.map((a) => (
                <div key={a.id} className={fr.cx("fr-col-12", "fr-col-md-6")}>
                  <button
                    type="button"
                    onClick={() => openDetail(a)}
                    className={fr.cx("fr-p-3w")}
                    style={{
                      display: "block",
                      width: "100%",
                      height: "100%",
                      textAlign: "left",
                      cursor: "pointer",
                      background: "var(--background-default-grey)",
                      border: "1px solid var(--border-default-grey)",
                      borderRadius: 8
                    }}
                  >
                    <h3 className={fr.cx("fr-h6", "fr-mb-1v")}>{a.titre}</h3>
                    <p className={fr.cx("fr-mb-0", "fr-text--sm")} style={{ color: "var(--text-mention-grey)" }}>
                      {a.resume}
                    </p>
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      {/* Navigation entre les mois */}
      <div
        className={fr.cx("fr-mt-4w", "fr-mb-3w")}
        style={{ display: "flex", flexWrap: "wrap", gap: 12 }}
      >
        {prevPeriode && (
          <Button
            priority="secondary"
            iconId="fr-icon-arrow-left-line"
            onClick={() => goTo(prevPeriode)}
          >
            Mois précédent
          </Button>
        )}
        <Button priority="tertiary" iconId="fr-icon-calendar-line" onClick={() => moisModal.open()}>
          Choisir un mois
        </Button>
        {!isCurrent && (
          <Button
            priority="secondary"
            iconId="fr-icon-arrow-go-back-line"
            onClick={() => goTo(currentPeriode)}
          >
            Revenir au mois en cours
          </Button>
        )}
      </div>

      <BandeauIA />

      {/* Modal de détail d'une actualité */}
      <detailModal.Component title={selected?.titre ?? ""}>
        {selected && (
          <div>
            <p style={{ whiteSpace: "pre-line" }}>{selected.contenu}</p>
            {selected.liens.length > 0 && (
              <>
                <h4 className={fr.cx("fr-h6", "fr-mt-3w")}>Sources officielles</h4>
                <ul>
                  {selected.liens.map((l, i) => (
                    <li key={i}>
                      <a href={l.url} target="_blank" rel="noreferrer" className={fr.cx("fr-link")}>
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </detailModal.Component>

      {/* Modal de sélection du mois */}
      <moisModal.Component title="Choisir un mois">
        {months.length === 0 ? (
          <p>Aucun mois disponible.</p>
        ) : (
          <ul className={fr.cx("fr-btns-group")}>
            {months.map((m) => (
              <li key={m}>
                <Button
                  priority={m === selectedPeriode ? "primary" : "tertiary"}
                  onClick={() => {
                    moisModal.close();
                    goTo(m);
                  }}
                >
                  {periodeLabel(m)}
                  {m === currentPeriode ? " (mois en cours)" : ""}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </moisModal.Component>
    </div>
  );
}
