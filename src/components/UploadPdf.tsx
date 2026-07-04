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
  const [result, setResult] = useState<{ filenames: string[]; resumeIA: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const fd = new FormData();
      for (const file of Array.from(files)) fd.append("file", file);
      if (rdvId) fd.append("rdvId", rdvId);
      if (contributionId) fd.append("contributionId", contributionId);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.ok) {
        setResult({ filenames: data.filenames, resumeIA: data.resumeIA });
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
        label="Déposer un ou plusieurs documents (PDF, max 10 Mo chacun)"
        hint="Les documents seront résumés ensemble par l'IA. Le résumé est non contradictoire."
        state="default"
        multiple
        nativeInputProps={{ accept: "application/pdf", multiple: true, onChange, disabled: loading }}
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
          title={`${result.filenames.length} document(s) ajouté(s) : ${result.filenames.join(", ")}`}
          description={`Résumé IA combiné : ${result.resumeIA}`}
        />
      )}
    </div>
  );
}
