import { fr } from "@codegouvfr/react-dsfr";
import { requireRole } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { RdvForm } from "@/components/RdvForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Demander un rendez-vous — Dépulib" };

export default async function RepresentantRdvPage() {
  await requireRole(["representant"]);
  const dossiers = await prisma.dossier.findMany({
    orderBy: { titre: "asc" },
    select: { id: true, titre: true }
  });

  return (
    <div className={fr.cx("fr-container", "fr-py-4w")}>
      <div className={fr.cx("fr-grid-row", "fr-grid-row--center")}>
        <div className={fr.cx("fr-col-12", "fr-col-md-8")}>
          <h1>Demander un rendez-vous</h1>
          <p>
            En tant que représentant d'intérêts, votre demande sera visible par le
            député avec votre fiche HATVP complète, en toute transparence.
          </p>
          <RdvForm dossiers={dossiers} redirectTo="/representant" />
        </div>
      </div>
    </div>
  );
}
