"use client";

import { fr } from "@codegouvfr/react-dsfr";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { useRouter } from "next/navigation";
import { useState } from "react";

type DossierOption = { id: string; titre: string };

export function RdvForm({
  dossiers,
  redirectTo
}: {
  dossiers: DossierOption[];
  redirectTo: string;
}) {
  const router = useRouter();
  const [sujet, setSujet] = useState("");
  const [date, setDate] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/rdv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sujet, date, dossierIds: selected })
      });
      const data = await res.json();
      if (data.ok) {
        setOk(true);
        setTimeout(() => {
          router.push(redirectTo);
          router.refresh();
        }, 1200);
      } else {
        setError(data.error ?? "Erreur");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  if (ok) {
    return (
      <Alert
        severity="success"
        closable={false}
        title="Demande envoyée"
        description="Votre rendez-vous a été demandé. Un brief IA a été généré pour le député. Redirection…"
      />
    );
  }

  return (
    <form onSubmit={submit}>
      <Input
        label="Sujet du rendez-vous"
        nativeInputProps={{
          value: sujet,
          onChange: (e) => setSujet(e.target.value),
          required: true,
          placeholder: "Ex. Protection des mineurs et vérification d'âge"
        }}
      />

      <Checkbox
        legend="Dossiers concernés (sélection multiple)"
        options={dossiers.map((d) => ({
          label: d.titre,
          nativeInputProps: {
            checked: selected.includes(d.id),
            onChange: () => toggle(d.id)
          }
        }))}
      />

      <Input
        label="Date souhaitée"
        nativeInputProps={{
          type: "date",
          value: date,
          onChange: (e) => setDate(e.target.value),
          required: true
        }}
      />

      {error && (
        <Alert severity="error" small description={error} className={fr.cx("fr-mb-2w")} closable={false} />
      )}

      <button type="submit" className={fr.cx("fr-btn")} disabled={loading}>
        {loading ? "Envoi et génération du brief…" : "Demander le rendez-vous"}
      </button>
    </form>
  );
}
