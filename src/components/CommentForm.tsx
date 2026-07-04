"use client";

import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { EncartAmendement } from "./EncartAmendement";
import type { Source } from "@/lib/sources";

type MatchResult = {
  commentaireId: string;
  amendement?: {
    id: string;
    numero: string;
    auteur: string;
    resumeIA: string;
    sourceUrl: string;
    sources?: Source[];
    upvotes: number;
  };
  auto?: boolean;
  moderationFlag: string;
  moderationMotif?: string | null;
  sentiment: number;
  debug?: {
    candidats: { numero: string; auteur: string; score: number }[];
    confiance: number;
    justification: string;
    seuil: number;
  } | null;
};

export function CommentForm({ dossierId }: { dossierId: string }) {
  const router = useRouter();
  const [texte, setTexte] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (texte.trim().length < 3) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/commentaires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dossierId, texte })
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Erreur lors de l'envoi");
        return;
      }
      const data: MatchResult = await res.json();
      setResult(data);
      setTexte("");
      router.refresh();
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={fr.cx("fr-mb-4w")}>
      <form onSubmit={submit}>
        <div className={fr.cx("fr-input-group")}>
          <label className={fr.cx("fr-label")} htmlFor="avis-texte">
            Votre avis sur ce dossier
            <span className={fr.cx("fr-hint-text")}>
              Il sera analysé, classé, et relié à l'amendement concerné le cas échéant.
            </span>
          </label>
          <textarea
            id="avis-texte"
            className={fr.cx("fr-input")}
            rows={4}
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            placeholder="Exprimez votre point de vue…"
          />
        </div>
        <button type="submit" className={fr.cx("fr-btn", "fr-mt-2w")} disabled={loading}>
          {loading ? "Analyse en cours…" : "Publier mon avis"}
        </button>
      </form>

      {error && (
        <Alert severity="error" small description={error} className={fr.cx("fr-mt-2w")} closable={false} />
      )}

      {result && (
        <div className={fr.cx("fr-mt-3w")}>
          {result.moderationFlag !== "ok" ? (
            <Alert
              severity="warning"
              small
              closable={false}
              title="Message publié mais masqué"
              description={`Votre avis a été signalé (${result.moderationMotif ?? result.moderationFlag}). Conformément à notre modération transparente, il n'est pas supprimé : il reste consultable, replié, et exclu des agrégats de sentiment.`}
            />
          ) : (
            <Alert
              severity="success"
              small
              closable={false}
              description="Votre avis a été publié."
            />
          )}

          {result.amendement ? (
            <EncartAmendement
              commentaireId={result.commentaireId}
              amendement={result.amendement}
              auto={result.auto}
            />
          ) : result.moderationFlag === "ok" ? (
            <>
              <p className={fr.cx("fr-text--sm", "fr-mt-2w")} style={{ color: "var(--text-mention-grey)" }}>
                Aucun amendement ne correspond assez précisément à votre avis pour être
                suggéré (l'IA préfère se taire que se tromper).
              </p>
              {result.debug && result.debug.candidats.length > 0 ? (
                <details
                  className={fr.cx("fr-mt-2w", "fr-p-2w")}
                  style={{ border: "1px dashed var(--border-default-grey)", borderRadius: 8 }}
                >
                  <summary style={{ cursor: "pointer", fontWeight: 500 }}>
                    <span className={fr.cx("fr-icon-bug-line", "fr-icon--sm")} aria-hidden />{" "}
                    Debug · top {result.debug.candidats.length} candidats (similarité cosinus)
                  </summary>
                  <p className={fr.cx("fr-text--xs", "fr-mt-2w", "fr-mb-1w")} style={{ color: "var(--text-mention-grey)" }}>
                    Confiance IA retenue : {result.debug.confiance.toFixed(2)} · seuil requis :{" "}
                    {result.debug.seuil.toFixed(2)}
                    {result.debug.justification ? ` — ${result.debug.justification}` : ""}
                  </p>
                  <ol className={fr.cx("fr-text--xs")} style={{ paddingLeft: "1.5rem", margin: 0 }}>
                    {result.debug.candidats.map((c, i) => (
                      <li key={i}>
                        n°{c.numero} — {c.auteur} ·{" "}
                        <strong>{c.score.toFixed(4)}</strong>
                      </li>
                    ))}
                  </ol>
                </details>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
