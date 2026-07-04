/**
 * Source de vérité partagée pour la rubrique « Quoi de neuf ? » : les 6
 * thématiques canoniques, leur couleur DSFR dédiée, et les utilitaires de
 * période (mois/année).
 *
 * ⚠️ La liste TOPICS et la logique de période sont dupliquées dans
 * scripts/fetch-actus.cjs (script CJS qui ne peut pas importer ce module TS).
 * Toute modification doit être répercutée des deux côtés — même compromis que
 * src/lib/cosinus.ts ↔ scripts/pseudoEmbedding.cjs.
 */

/** Les 6 thématiques canoniques, dans l'ordre d'affichage. */
export const TOPICS = [
  "Énergie et Logement",
  "Transports et Mobilité",
  "Travail et Économie",
  "Santé et Cohésion sociale",
  "Commerce et Pouvoir d'achat",
  "Administration et Vie civique"
] as const;

export type Topic = (typeof TOPICS)[number];

/** Thématique par défaut quand la classification échoue. */
export const TOPIC_FALLBACK: Topic = "Administration et Vie civique";

/**
 * Une couleur DSFR (famille « système ») par thématique. Utilisée pour l'accent
 * de chaque section (bordure + pastille). Les familles existent déjà dans le
 * DSFR (cf. fr-callout--blue-ecume dans DossierTabs.tsx).
 */
export const TOPIC_COLOR: Record<Topic, string> = {
  "Énergie et Logement": "green-emeraude",
  "Transports et Mobilité": "blue-ecume",
  "Travail et Économie": "orange-terre-battue",
  "Santé et Cohésion sociale": "pink-macaron",
  "Commerce et Pouvoir d'achat": "purple-glycine",
  "Administration et Vie civique": "yellow-tournesol"
};

/** Renvoie la variable CSS DSFR d'accent (fond clair) pour une thématique. */
export function topicVar(topic: string): string {
  const fam = TOPIC_COLOR[(topic as Topic)] ?? TOPIC_COLOR[TOPIC_FALLBACK];
  return `var(--background-action-low-${fam})`;
}

/** Renvoie la variable CSS DSFR de bordure pour une thématique. */
export function topicBorderVar(topic: string): string {
  const fam = TOPIC_COLOR[(topic as Topic)] ?? TOPIC_COLOR[TOPIC_FALLBACK];
  return `var(--border-plain-${fam})`;
}

/** Renvoie la variable CSS DSFR de couleur de texte (label) pour une thématique. */
export function topicTextVar(topic: string): string {
  const fam = TOPIC_COLOR[(topic as Topic)] ?? TOPIC_COLOR[TOPIC_FALLBACK];
  return `var(--text-label-${fam})`;
}

export type ActuLien = { url: string; label: string };

export type Actu = {
  id: string;
  periode: string;
  topic: string;
  titre: string;
  contenu: string;
  resume: string;
  liens: ActuLien[];
  sourceUrl: string;
};

/** Période "YYYY-MM" du mois courant. */
export function currentPeriode(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

const MOIS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre"
];

/** "2026-07" → "Juillet 2026". */
export function periodeLabel(periode: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(periode);
  if (!m) return periode;
  const idx = Number(m[2]) - 1;
  if (idx < 0 || idx > 11) return periode;
  const nom = MOIS_FR[idx];
  return `${nom.charAt(0).toUpperCase()}${nom.slice(1)} ${m[1]}`;
}
