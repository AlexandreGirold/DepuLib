"use client";

import { fr } from "@codegouvfr/react-dsfr";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Select } from "@codegouvfr/react-dsfr/Select";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export type CreneauGestion = {
  id: string;
  debut: string;
  fin: string;
  statut: string;
  publicCible: string;
  rdvId?: string | null;
};

const formatJour = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const formatHeure = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const PUBLIC_LABEL: Record<string, string> = {
  citoyen: "Citoyens",
  representant: "Représentants d'intérêts"
};

/**
 * Gestion des créneaux de permanence par le député (F6) : ouverture de
 * disponibilités dédiées soit aux citoyens, soit aux représentants d'intérêts
 * — ce sont ces créneaux qui apparaissent ensuite dans le formulaire de RDV
 * de chaque espace. Lecture seule pour le collaborateur (F10).
 */
export function GestionCreneaux({
  creneaux,
  canAct
}: {
  creneaux: CreneauGestion[];
  canAct: boolean;
}) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [heureDebut, setHeureDebut] = useState("14:00");
  const [heureFin, setHeureFin] = useState("15:00");
  const [publicCible, setPublicCible] = useState("citoyen");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suppressionId, setSuppressionId] = useState<string | null>(null);

  const parJour = useMemo(() => {
    const carte = new Map<string, CreneauGestion[]>();
    for (const c of creneaux) {
      const jour = capitalise(formatJour.format(new Date(c.debut)));
      const liste = carte.get(jour) ?? [];
      liste.push(c);
      carte.set(jour, liste);
    }
    return carte;
  }, [creneaux]);

  async function ajouter(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !heureDebut || !heureFin) return;
    setError(null);
    setLoading(true);
    try {
      const debut = new Date(`${date}T${heureDebut}:00`);
      const fin = new Date(`${date}T${heureFin}:00`);
      const res = await fetch("/api/creneaux", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ debut: debut.toISOString(), fin: fin.toISOString(), publicCible })
      });
      const data = await res.json();
      if (data.ok) {
        setDate("");
        router.refresh();
      } else {
        setError(data.error ?? "Erreur");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  async function retirer(id: string) {
    setError(null);
    setSuppressionId(id);
    try {
      const res = await fetch(`/api/creneaux/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        router.refresh();
      } else {
        setError(data.error ?? "Erreur");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setSuppressionId(null);
    }
  }

  return (
    <div className={`fr-background-alt--grey ${fr.cx("fr-p-3w", "fr-p-md-4w", "fr-mb-4w")}`} style={{ borderRadius: 8 }}>
      <h2 className={fr.cx("fr-h5")}>Vos disponibilités</h2>
      <p className={fr.cx("fr-text--sm")}>
        Ouvrez des créneaux de permanence pour les citoyens ou pour les représentants
        d'intérêts. Ils apparaissent immédiatement dans leurs formulaires de demande de
        rendez-vous.
      </p>

      {canAct && (
        <form
          onSubmit={ajouter}
          className={fr.cx("fr-grid-row", "fr-grid-row--bottom")}
          style={{ gap: "1rem", alignItems: "flex-end" }}
        >
          <div className={fr.cx("fr-col-12", "fr-col-md-3")}>
            <Input
              label="Date"
              nativeInputProps={{
                type: "date",
                value: date,
                onChange: (e) => setDate(e.target.value),
                required: true
              }}
            />
          </div>
          <div className={fr.cx("fr-col-6", "fr-col-md-2")}>
            <Input
              label="Début"
              nativeInputProps={{
                type: "time",
                value: heureDebut,
                onChange: (e) => setHeureDebut(e.target.value),
                required: true
              }}
            />
          </div>
          <div className={fr.cx("fr-col-6", "fr-col-md-2")}>
            <Input
              label="Fin"
              nativeInputProps={{
                type: "time",
                value: heureFin,
                onChange: (e) => setHeureFin(e.target.value),
                required: true
              }}
            />
          </div>
          <div className={fr.cx("fr-col-12", "fr-col-md-3")}>
            <Select
              label="Ouvert pour"
              nativeSelectProps={{
                value: publicCible,
                onChange: (e) => setPublicCible(e.target.value)
              }}
            >
              <option value="citoyen">Citoyens</option>
              <option value="representant">Représentants d'intérêts</option>
            </Select>
          </div>
          <div className={fr.cx("fr-col-12", "fr-col-md-2")}>
            <button type="submit" className={fr.cx("fr-btn", "fr-mb-3w")} disabled={loading}>
              {loading ? "Ajout…" : "Ajouter"}
            </button>
          </div>
        </form>
      )}

      {error && <Alert severity="error" small description={error} closable={false} className={fr.cx("fr-mb-3w")} />}

      {creneaux.length === 0 ? (
        <p className={fr.cx("fr-text--sm")} style={{ color: "var(--text-mention-grey)" }}>
          Aucun créneau ouvert pour le moment.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {[...parJour.entries()].map(([jour, creneauxDuJour]) => (
            <div key={jour}>
              <p className={fr.cx("fr-text--sm", "fr-mb-1w")} style={{ fontWeight: 500 }}>
                {jour}
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
                  gap: "0.75rem"
                }}
              >
                {creneauxDuJour.map((c) => {
                  const libre = c.statut === "libre";
                  const contenu = (
                    <>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "0.5rem"
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>
                          {formatHeure.format(new Date(c.debut))}–{formatHeure.format(new Date(c.fin))}
                        </span>
                        {canAct && libre && (
                          <button
                            type="button"
                            aria-label={`Retirer le créneau du ${jour}`}
                            onClick={() => retirer(c.id)}
                            disabled={suppressionId === c.id}
                            className={fr.cx(
                              "fr-btn",
                              "fr-btn--tertiary-no-outline",
                              "fr-btn--sm",
                              "fr-icon-close-line"
                            )}
                          />
                        )}
                      </div>
                      <div className={fr.cx("fr-badges-group")} style={{ marginTop: "0.5rem" }}>
                        <Badge small noIcon severity={c.publicCible === "representant" ? "warning" : "new"}>
                          {PUBLIC_LABEL[c.publicCible] ?? c.publicCible}
                        </Badge>
                        <Badge small noIcon severity={libre ? "success" : "info"}>
                          {libre ? "Libre" : "Réservé"}
                        </Badge>
                      </div>
                      {!libre && c.rdvId && (
                        <p
                          className={fr.cx("fr-text--xs", "fr-mb-0")}
                          style={{ marginTop: "0.5rem", color: "var(--text-action-high-blue-france)" }}
                        >
                          Voir la fiche du rendez-vous →
                        </p>
                      )}
                    </>
                  );
                  const boxStyle: React.CSSProperties = {
                    display: "block",
                    boxSizing: "border-box",
                    height: "100%",
                    padding: "1rem 1.25rem",
                    border: "1px solid var(--border-default-grey)",
                    borderRadius: 8,
                    background: "var(--background-default-grey)",
                    color: "inherit",
                    textDecoration: "none"
                  };
                  return !libre && c.rdvId ? (
                    <Link key={c.id} href={`/depute/rdv/${c.rdvId}`} style={boxStyle}>
                      {contenu}
                    </Link>
                  ) : (
                    <div key={c.id} style={boxStyle}>
                      {contenu}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {!canAct && (
        <p className={fr.cx("fr-text--xs", "fr-mt-2w")} style={{ color: "var(--text-mention-grey)" }}>
          En tant que collaborateur, vous consultez les disponibilités mais ne pouvez pas
          en ouvrir ni en retirer.
        </p>
      )}
    </div>
  );
}
