import { fr } from "@codegouvfr/react-dsfr";
import { requireRole } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { RdvForm } from "@/components/RdvForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Demander un rendez-vous — Dépulib" };

export default async function CitoyenRdvPage() {
  await requireRole(["citoyen"]);
  const dossiers = await prisma.dossier.findMany({
    orderBy: { titre: "asc" },
    select: { id: true, titre: true }
  });

  return (
    <div className={fr.cx("fr-container", "fr-py-4w")}>
      <div className={fr.cx("fr-grid-row", "fr-grid-row--center")}>
        <div className={fr.cx("fr-col-12", "fr-col-md-8")}>
          <h1>Demander un rendez-vous à votre députée</h1>
          <p>
            Décrivez votre sujet et sélectionnez les dossiers concernés. Un brief
            synthétique, sourcé sur les textes officiels, sera généré pour préparer
            l'échange.
          </p>
          <RdvForm dossiers={dossiers} redirectTo="/citoyen" />
        </div>
      </div>
    </div>
  );
}
