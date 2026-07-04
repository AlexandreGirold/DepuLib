import { fr } from "@codegouvfr/react-dsfr";

/**
 * Jauge d'accord / désaccord — composant custom sur base DSFR.
 * `value` est une moyenne de sentiments dans [-2, +2].
 */
export function JaugeSentiment({
  value,
  count,
  compact
}: {
  value: number;
  count: number;
  compact?: boolean;
}) {
  const clamped = Math.max(-2, Math.min(2, value));
  // position 0..100 (—2 → 0%, +2 → 100%)
  const pct = ((clamped + 2) / 4) * 100;
  const color =
    clamped > 0.5
      ? "var(--background-flat-success)"
      : clamped < -0.5
      ? "var(--background-flat-error)"
      : "var(--background-flat-grey)";
  const label =
    clamped > 0.5
      ? "Plutôt favorable"
      : clamped < -0.5
      ? "Plutôt défavorable"
      : "Partagé";

  return (
    <div>
      {!compact && (
        <div
          className={fr.cx("fr-text--sm")}
          style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}
        >
          <span>Désaccord</span>
          <strong>{label}</strong>
          <span>Accord</span>
        </div>
      )}
      <div
        style={{
          position: "relative",
          height: compact ? 8 : 14,
          borderRadius: 999,
          background:
            "linear-gradient(90deg, var(--background-contrast-error) 0%, var(--background-contrast-grey) 50%, var(--background-contrast-success) 100%)"
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -3,
            left: `calc(${pct}% - ${compact ? 5 : 7}px)`,
            width: compact ? 10 : 14,
            height: compact ? 14 : 20,
            borderRadius: 4,
            background: color,
            border: "2px solid var(--background-default-grey)"
          }}
        />
      </div>
      <p
        className={fr.cx("fr-text--xs", "fr-mt-1v", "fr-mb-0")}
        style={{ color: "var(--text-mention-grey)" }}
      >
        Moyenne {clamped.toFixed(2)} sur {count} avis pris en compte
        {compact ? ` — ${label}` : ""}
      </p>
    </div>
  );
}
