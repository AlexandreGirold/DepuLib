import { fr } from "@codegouvfr/react-dsfr";
import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { requireRole } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { RdvForm } from "@/components/RdvForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Demander un rendez-vous — Dépulib" };

export default async function CitoyenRdvPage({
  searchParams
}: {
  searchParams: { dossierId?: string };
}) {
  await requireRole(["citoyen"]);
  const dossiers = await prisma.dossier.findMany({
    orderBy: { titre: "asc" },
    select: { id: true, titre: true, numero: true, statut: true, commission: true }
  });

  return (
    <div className={fr.cx("fr-container", "fr-py-4w")}>
      <div className={fr.cx("fr-grid-row", "fr-grid-row--center")}>
        <div className={fr.cx("fr-col-12", "fr-col-md-8")}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }} className={fr.cx("fr-mb-2w")}>
            <img
              src="/dsfr/artwork/pictograms/environment/human-cooperation.svg"
              alt=""
              width={56}
              height={56}
            />
            <h1 className={fr.cx("fr-mb-0")}>Demander un rendez-vous à votre députée</h1>
          </div>
          <CallOut iconId="fr-icon-information-line" title="Comment ça marche ?" className={fr.cx("fr-mb-3w")}>
            Décrivez votre sujet et recherchez les dossiers concernés. Un brief
            synthétique, sourcé sur les textes officiels, est généré automatiquement
            pour préparer l'échange avec la députée.
          </CallOut>
          <RdvForm dossiers={dossiers} redirectTo="/citoyen" preselectionId={searchParams.dossierId} />
        </div>
      </div>
    </div>
  );
}
