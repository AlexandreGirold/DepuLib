"use client";

import { fr } from "@codegouvfr/react-dsfr";
import { Select } from "@codegouvfr/react-dsfr/Select";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadPdf } from "./UploadPdf";

type DossierOption = { id: string; titre: string };

export function ContributionForm({ dossiers }: { dossiers: DossierOption[] }) {
  const router = useRouter();
  const [dossierId, setDossierId] = useState("");
  const [position, setPosition] = useState("favorable");
  const [argumentaire, setArgumentaire] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dossierId, position, argumentaire })
      });
      const data = await res.json();
      if (data.ok) {
        setCreatedId(data.contributionId);
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

  if (createdId) {
    return (
      <div>
        <Alert
          severity="success"
          closable={false}
          title="Contribution déposée"
          description="Elle est désormais visible par le député, dans l'onglet dédié aux contributions des représentants d'intérêts, séparée des avis citoyens."
        />
        <div className={fr.cx("fr-mt-2w")}>
          <p className={fr.cx("fr-text--sm")}>
            Vous pouvez joindre un ou plusieurs documents justificatifs :
          </p>
          <UploadPdf contributionId={createdId} />
        </div>
        <button
          type="button"
          className={fr.cx("fr-btn", "fr-btn--secondary", "fr-mt-2w")}
          onClick={() => {
            setCreatedId(null);
            setArgumentaire("");
          }}
        >
          Déposer une autre contribution
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <Select
        label="Dossier concerné"
        nativeSelectProps={{ value: dossierId, onChange: (e) => setDossierId(e.target.value), required: true }}
      >
        <option value="">— Choisir un dossier —</option>
        {dossiers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.titre}
          </option>
        ))}
      </Select>

      <Select
        label="Position"
        nativeSelectProps={{ value: position, onChange: (e) => setPosition(e.target.value) }}
      >
        <option value="favorable">Favorable</option>
        <option value="defavorable">Défavorable</option>
        <option value="amendement">Amendement souhaité</option>
      </Select>

      <div className={fr.cx("fr-input-group")}>
        <label className={fr.cx("fr-label")} htmlFor="argumentaire">
          Argumentaire
          <span className={fr.cx("fr-hint-text")}>Exposez votre position de façon factuelle.</span>
        </label>
        <textarea
          id="argumentaire"
          className={fr.cx("fr-input")}
          rows={5}
          value={argumentaire}
          onChange={(e) => setArgumentaire(e.target.value)}
          required
        />
      </div>

      {error && (
        <Alert severity="error" small description={error} className={fr.cx("fr-my-2w")} closable={false} />
      )}

      <button type="submit" className={fr.cx("fr-btn", "fr-mt-2w")} disabled={loading || !dossierId}>
        {loading ? "Dépôt en cours…" : "Déposer ma contribution"}
      </button>
    </form>
  );
}
