import { fr } from "@codegouvfr/react-dsfr";
import Link from "next/link";
import { getDossiers, getCommissions } from "@/lib/data";
import { requireRole } from "@/lib/guards";
import { CommissionTiles } from "@/components/CommissionTiles";
import { DossiersSearch } from "@/components/DossiersSearch";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dossiers en débat — Dépulib" };

export default async function CitoyenHome({
  searchParams
}: {
  searchParams: { commission?: string };
}) {
  const user = await requireRole(["citoyen"]);
  const commissions = await getCommissions();
  const commission =
    searchParams.commission && commissions.some((c) => c.commission === searchParams.commission)
      ? searchParams.commission
      : undefined;

  // --- Landing : sélection d'une commission ---
  if (!commission) {
    return (
      <div className={fr.cx("fr-container", "fr-py-4w")}>
        <h1>Les commissions permanentes</h1>
        <p className={fr.cx("fr-text--lead")}>
          Bonjour {user.displayName}. Les textes en discussion sont répartis entre
          les commissions permanentes de l'Assemblée nationale. Choisissez une
          commission pour voir les lois qu'elle examine et donner votre avis.
        </p>
        <CommissionTiles commissions={commissions} />
      </div>
    );
  }

  // --- Lois d'une commission ---
  const dossiers = await getDossiers({ commission });
  const items = dossiers.map((d) => ({
    id: d.id,
    titre: d.titre,
    numero: d.numero,
    statut: d.statut,
    extrait: d.expose.slice(0, 170).replace(/\s+\S*$/, "") + "…",
    amendements: d._count.amendements,
    commentaires: d._count.commentaires
  }));

  return (
    <div className={fr.cx("fr-container", "fr-py-4w")}>
      <div className={fr.cx("fr-mb-4w")}>
        <Link
          href="/citoyen"
          className={fr.cx("fr-link", "fr-icon-arrow-left-line", "fr-link--icon-left")}
        >
          Toutes les commissions
        </Link>
      </div>
      <h1 className={fr.cx("fr-mb-3w")}>{commission}</h1>

      <DossiersSearch dossiers={items} />
    </div>
  );
}
