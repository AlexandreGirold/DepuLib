import type { Role } from "@/lib/session";

/**
 * Bandeau collant (bas de page) qui rappelle en permanence dans quel espace
 * l'utilisateur navigue : Citoyen, Députée ou Représentant d'intérêts.
 * Une couleur + un logo blanc distinct par type de vue, pour éviter toute
 * confusion sur « qui voit quoi ».
 */

export const VIEW_BANNER_HEIGHT = 40;

type ViewConfig = {
  label: string;
  tagline: string;
  color: string;
  /** Tracé du logo (Remix Icon / DSFR), rendu en blanc dans une viewBox 24×24. */
  path: string;
};

// Logos DSFR (Remix Icon) — user-line, government-line, briefcase-line.
const ICON_CITOYEN =
  "M12 14a8 8 0 0 1 8 8h-2a6 6 0 1 0-12 0H4a8 8 0 0 1 8-8Zm0-13c3.315 0 6 2.685 6 6s-2.685 6-6 6-6-2.685-6-6 2.685-6 6-6Zm0 2C9.79 3 8 4.79 8 7s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4Z";
const ICON_DEPUTE =
  "M19 3a1 1 0 0 1 1 1v2h3v2h-1v11h1v2H1v-2h1V8H1V6h3V4a1 1 0 0 1 1-1h14Zm1 5H4v11h3v-7h2v7h2v-7h2v7h2v-7h2v7h3V8Zm-2-3H6v1h12V5Z";
const ICON_REPRESENTANT =
  "M16 1a1 1 0 0 1 1 1v3h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4V2a1 1 0 0 1 1-1h8Zm4 15H4v3h16v-3Zm0-9H4v7h16V7Zm-7 4v2h-2v-2h2Zm2-8H9v2h6V3Z";

const VIEW_CONFIG: Record<Role, ViewConfig> = {
  citoyen: {
    label: "Espace citoyen",
    tagline: "Vue publique",
    color: "#000091", // Bleu France
    path: ICON_CITOYEN
  },
  representant: {
    label: "Espace représentant d'intérêts",
    tagline: "Contributions & transparence",
    color: "#B34000", // Orange terre de sienne
    path: ICON_REPRESENTANT
  },
  depute: {
    label: "Espace députée",
    tagline: "Vue parlementaire",
    color: "#18753C", // Vert institution
    path: ICON_DEPUTE
  },
  collaborateur: {
    label: "Espace cabinet",
    tagline: "Collaborateur parlementaire",
    color: "#18753C", // Même famille que la députée
    path: ICON_DEPUTE
  }
};

export function ViewBanner({ role }: { role: Role | null | undefined }) {
  if (!role) return null;
  const cfg = VIEW_CONFIG[role];
  if (!cfg) return null;

  return (
    <div
      role="status"
      aria-label={`Vous naviguez dans l'${cfg.label.toLowerCase()}`}
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        top: 0,
        zIndex: 900,
        height: VIEW_BANNER_HEIGHT,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.75rem",
        padding: "0 1rem",
        background: cfg.color,
        color: "#fff",
        boxShadow: "0 2px 8px rgba(0, 0, 18, 0.25)",
        fontSize: "0.875rem",
        lineHeight: 1
      }}
    >
      <svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        fill="#fff"
        aria-hidden="true"
        focusable="false"
        style={{ flex: "0 0 auto" }}
      >
        <path d={cfg.path} />
      </svg>
      <span
        style={{
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em"
        }}
      >
        {cfg.label}
      </span>
      <span aria-hidden="true" style={{ opacity: 0.55 }}>
        ·
      </span>
      <span style={{ opacity: 0.9 }}>{cfg.tagline}</span>
    </div>
  );
}
