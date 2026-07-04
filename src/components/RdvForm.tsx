"use client";

import { fr } from "@codegouvfr/react-dsfr";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { Tag } from "@codegouvfr/react-dsfr/Tag";
import { Stepper } from "@codegouvfr/react-dsfr/Stepper";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DeputePicker, type DeputeOption } from "./DeputePicker";
import { CreneauPicker } from "./CreneauPicker";

type DossierOption = {
  id: string;
  titre: string;
  numero: string;
  statut: string;
  commission: string;
};

const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const MAX_RESULTATS = 8;
const SEUIL_ALERTE = 3;
const AVATAR_GENERIQUE = "/dsfr/artwork/pictograms/system/avatar.svg";

const ETAPES = {
  depute: "Choisir le député",
  demande: "Votre demande",
  reponse: "Réponse du député"
};

export function RdvForm({
  dossiers,
  deputes,
  redirectTo,
  preselectionId
}: {
  dossiers: DossierOption[];
  deputes: DeputeOption[];
  redirectTo: string;
  preselectionId?: string;
}) {
  const router = useRouter();
  const [deputeId, setDeputeId] = useState<string | null>(null);
  const [sujet, setSujet] = useState("");
  const [creneauId, setCreneauId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(
    preselectionId && dossiers.some((d) => d.id === preselectionId) ? [preselectionId] : []
  );
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  // Cas d'entrée depuis la fiche d'un dossier (?dossierId=...) : présélection.
  useEffect(() => {
    if (preselectionId && dossiers.some((d) => d.id === preselectionId)) {
      setSelected((prev) => (prev.includes(preselectionId) ? prev : [preselectionId, ...prev]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectionId]);

  const depute = useMemo(() => deputes.find((d) => d.id === deputeId) ?? null, [deputes, deputeId]);

  const selectedDossiers = useMemo(
    () => selected.map((id) => dossiers.find((d) => d.id === id)).filter(Boolean) as DossierOption[],
    [selected, dossiers]
  );

  const resultats = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return [];
    return dossiers
      .filter((d) => !selected.includes(d.id))
      .filter((d) => {
        const hay = norm([d.titre, d.numero, d.statut, d.commission].join(" "));
        return q.split(/\s+/).every((mot) => hay.includes(mot));
      })
      .slice(0, MAX_RESULTATS);
  }, [dossiers, query, selected]);

  function ajouter(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setQuery("");
  }

  function retirer(id: string) {
    setSelected((prev) => prev.filter((x) => x !== id));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!deputeId || !creneauId) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/rdv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sujet, deputeId, creneauId, dossierIds: selected })
      });
      const data = await res.json();
      if (data.ok) {
        setOk(true);
        setTimeout(() => {
          router.push(redirectTo);
          router.refresh();
        }, 1800);
      } else {
        setError(data.error ?? "Erreur");
        // Le créneau a pu être réservé entre-temps : on force à en reprendre un.
        setCreneauId(null);
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  if (ok) {
    return (
      <div className={`fr-background-alt--grey ${fr.cx("fr-p-4w")}`} style={{ textAlign: "center", borderRadius: 8 }}>
        <img
          src="/dsfr/artwork/pictograms/system/success.svg"
          alt=""
          width={72}
          height={72}
          style={{ marginBottom: "0.5rem" }}
        />
        <h2 className={fr.cx("fr-mb-1w")}>Demande envoyée</h2>
        <p className={fr.cx("fr-mb-3w")}>
          Un brief synthétique, sourcé sur les textes officiels, a été généré pour
          {depute ? ` ${depute.civilite ?? ""} ${depute.displayName}` : " le député"} à
          partir de votre sélection. Redirection…
        </p>
        <div style={{ textAlign: "left", maxWidth: 480, margin: "0 auto" }}>
          <Stepper
            currentStep={2}
            stepCount={3}
            title="Demande envoyée, brief IA généré"
            nextTitle={ETAPES.reponse}
          />
        </div>
      </div>
    );
  }

  // --- Étape 1 : choix du député ---
  if (!depute) {
    return (
      <div>
        <div className={fr.cx("fr-mb-3w")} style={{ maxWidth: 480 }}>
          <Stepper currentStep={1} stepCount={3} title={ETAPES.depute} nextTitle={ETAPES.demande} />
        </div>
        <div className={`fr-background-alt--grey ${fr.cx("fr-p-3w", "fr-p-md-4w")}`} style={{ borderRadius: 8 }}>
          <DeputePicker deputes={deputes} onSelect={setDeputeId} />
        </div>
      </div>
    );
  }

  // --- Étape 2 : sujet, dossiers, créneau ---
  return (
    <form onSubmit={submit}>
      <div className={fr.cx("fr-mb-3w")} style={{ maxWidth: 480 }}>
        <Stepper currentStep={2} stepCount={3} title={ETAPES.demande} nextTitle={ETAPES.reponse} />
      </div>

      <div
        className={fr.cx("fr-mb-3w")}
        style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
      >
        <img
          src={depute.photoUrl || AVATAR_GENERIQUE}
          alt=""
          width={40}
          height={40}
          style={{ borderRadius: "50%", objectFit: "cover" }}
        />
        <span>
          Rendez-vous avec {depute.civilite ? `${depute.civilite} ` : ""}
          {depute.displayName}
          {depute.circonscription ? ` (circonscription ${depute.circonscription})` : ""}
        </span>
        <button
          type="button"
          onClick={() => {
            setDeputeId(null);
            setCreneauId(null);
          }}
          className={fr.cx("fr-link", "fr-text--sm")}
        >
          Changer de député
        </button>
      </div>

      <div className={`fr-background-alt--grey ${fr.cx("fr-p-3w", "fr-p-md-4w")}`} style={{ borderRadius: 8 }}>
        <Input
          label="Sujet du rendez-vous"
          hintText="En une phrase, ce qui vous préoccupe."
          iconId="fr-icon-edit-line"
          nativeInputProps={{
            value: sujet,
            onChange: (e) => setSujet(e.target.value),
            required: true,
            placeholder: "Ex. Protection des mineurs et vérification d'âge"
          }}
        />

        <hr className={fr.cx("fr-hr", "fr-my-3w")} />

        <div>
          <label className={fr.cx("fr-label")} htmlFor="rdv-recherche-dossier">
            <span className={fr.cx("fr-icon-file-text-line", "fr-icon--sm")} aria-hidden /> Dossiers
            concernés (optionnel)
            <span className={fr.cx("fr-hint-text")}>
              Recherchez les lois concernées par votre sujet ; cela permet à l'IA de
              préparer un brief plus pertinent pour le député.
            </span>
          </label>

          {selectedDossiers.length > 0 && (
            <ul
              className={fr.cx("fr-tags-group", "fr-mb-1w")}
              style={{ listStyle: "none", padding: 0 }}
              aria-label="Dossiers sélectionnés"
            >
              {selectedDossiers.map((d) => (
                <li key={d.id} style={{ display: "inline-block" }}>
                  <Tag
                    dismissible
                    small
                    nativeButtonProps={{
                      "aria-label": `Retirer le dossier ${d.titre}`,
                      onClick: () => retirer(d.id)
                    }}
                    title={d.titre}
                  >
                    {d.titre.length > 60 ? d.titre.slice(0, 57) + "…" : d.titre}
                  </Tag>
                </li>
              ))}
            </ul>
          )}

          <div className={fr.cx("fr-search-bar")} role="search" style={{ maxWidth: 560 }}>
            <input
              id="rdv-recherche-dossier"
              className={fr.cx("fr-input")}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Titre, numéro, commission…"
              role="combobox"
              aria-expanded={resultats.length > 0}
              aria-controls="rdv-resultats-dossiers"
              autoComplete="off"
            />
            <button type="button" className={fr.cx("fr-btn")} tabIndex={-1} title="Rechercher">
              Rechercher
            </button>
          </div>

          <p aria-live="polite" className={fr.cx("fr-text--xs")} style={{ color: "var(--text-mention-grey)" }}>
            {selected.length > 0
              ? `${selected.length} dossier${selected.length > 1 ? "s" : ""} sélectionné${selected.length > 1 ? "s" : ""} — le brief IA portera sur ${selected.length > 1 ? "ces dossiers" : "ce dossier"}.`
              : "Aucun dossier sélectionné pour l'instant"}
            {selected.length > SEUIL_ALERTE &&
              " Pour un brief IA plus ciblé, privilégiez 2 à 3 dossiers les plus pertinents."}
          </p>

          {query.trim() && (
            <ul
              id="rdv-resultats-dossiers"
              role="listbox"
              aria-label="Résultats de recherche de dossiers"
              className={fr.cx("fr-mt-1w")}
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                maxWidth: 560,
                border: resultats.length ? "1px solid var(--border-default-grey)" : undefined,
                background: resultats.length ? "var(--background-default-grey)" : undefined
              }}
            >
              {resultats.map((d) => (
                <li key={d.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onClick={() => ajouter(d.id)}
                    className={fr.cx("fr-btn", "fr-btn--tertiary-no-outline")}
                    style={{ width: "100%", textAlign: "left", display: "block", height: "auto", padding: "0.75rem 1rem" }}
                  >
                    <span style={{ display: "block" }}>{d.titre}</span>
                    <span className={fr.cx("fr-badges-group", "fr-mt-1v")}>
                      <Badge small noIcon severity="info">{d.commission}</Badge>
                      <Badge small noIcon>{d.numero}</Badge>
                    </span>
                  </button>
                </li>
              ))}
              {resultats.length === 0 && (
                <li className={fr.cx("fr-text--sm")} style={{ padding: "0.5rem 0", color: "var(--text-mention-grey)" }}>
                  Aucun dossier ne correspond à « {query} ».
                </li>
              )}
            </ul>
          )}
        </div>

        <hr className={fr.cx("fr-hr", "fr-my-3w")} />

        <div>
          <label className={fr.cx("fr-label")}>
            <span className={fr.cx("fr-icon-calendar-event-line", "fr-icon--sm")} aria-hidden /> Créneau
            de rendez-vous
            <span className={fr.cx("fr-hint-text")}>
              Choisissez un créneau parmi les disponibilités du député.
            </span>
          </label>
          <CreneauPicker deputeId={depute.id} value={creneauId} onChange={(id) => setCreneauId(id)} />
        </div>
      </div>

      {error && (
        <Alert severity="error" small description={error} className={fr.cx("fr-mt-3w")} closable={false} />
      )}

      <button
        type="submit"
        className={fr.cx("fr-btn", "fr-btn--lg", "fr-icon-send-plane-line", "fr-btn--icon-right", "fr-mt-3w")}
        disabled={loading || !creneauId}
      >
        {loading ? "Envoi et génération du brief…" : "Envoyer ma demande et générer le brief"}
      </button>
    </form>
  );
}
