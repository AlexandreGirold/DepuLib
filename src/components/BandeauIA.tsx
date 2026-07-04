import { fr } from "@codegouvfr/react-dsfr";

/**
 * Bandeau permanent en pied de chaque bloc IA (fil rouge « IA de confiance »).
 */
export function BandeauIA({ degrade }: { degrade?: boolean }) {
  return (
    <p
      className={fr.cx("fr-text--xs", "fr-mt-1w", "fr-mb-0")}
      style={{ color: "var(--text-mention-grey)" }}
    >
      <span className={fr.cx("fr-icon-information-line", "fr-icon--xs")} aria-hidden />{" "}
      Synthèse générée par IA — vérifiez les sources.
      {degrade ? " (Mode dégradé : réponse déterministe de secours.)" : ""}
    </p>
  );
}
