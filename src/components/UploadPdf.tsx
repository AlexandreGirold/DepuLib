"use client";

import { fr } from "@codegouvfr/react-dsfr";
import { Upload } from "@codegouvfr/react-dsfr/Upload";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Upload PDF (F7 / F8). Rattaché à un RDV ou une contribution.
 */
export function UploadPdf({
  rdvId,
  contributionId
}: {
  rdvId?: string;
  contributionId?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ filename: string; resumeIA: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (rdvId) fd.append("rdvId", rdvId);
      if (contributionId) fd.append("contributionId", contributionId);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.ok) {
        setResult({ filename: data.filename, resumeIA: data.resumeIA });
        router.refresh();
      } else {
        setError(data.error ?? "Erreur d'upload");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Upload
        label="Déposer un document (PDF, max 10 Mo)"
        hint="Le document sera résumé par l'IA. Le résumé est non contradictoire."
        state="default"
        nativeInputProps={{ accept: "application/pdf", onChange, disabled: loading }}
      />
      {loading && (
        <p className={fr.cx("fr-text--sm")}>Extraction et résumé en cours…</p>
      )}
      {error && (
        <Alert severity="error" small description={error} closable={false} className={fr.cx("fr-mt-1w")} />
      )}
      {result && (
        <Alert
          severity="success"
          small
          closable={false}
          className={fr.cx("fr-mt-1w")}
          title={`Document « ${result.filename} » ajouté`}
          description={`Résumé IA : ${result.resumeIA}`}
        />
      )}
    </div>
  );
}
