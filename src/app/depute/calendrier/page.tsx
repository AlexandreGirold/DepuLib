import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { Table } from "@codegouvfr/react-dsfr/Table";
import Link from "next/link";
import { requireRole } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { isoWeekKey, weekLabel, formatDate } from "@/lib/dates";
import { notFound } from "next/navigation";
import { GestionCreneaux } from "@/components/GestionCreneaux";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendrier — Dépulib" };

const STATUT: Record<string, { label: string; severity: any }> = {
  demande: { label: "En attente", severity: "info" },
  accepte: { label: "Accepté", severity: "success" },
  refuse: { label: "Refusé", severity: "error" }
};

const TYPE_LABEL: Record<string, string> = {
  citoyen: "Citoyen",
  representant: "Représentant d'intérêts"
};

export default async function CalendrierPage() {
  const user = await requireRole(["depute", "collaborateur"]);
  const deputeId = user.role === "depute" ? user.id : user.deputeId;
  if (!deputeId) notFound();

  const rdvs = await prisma.rendezVous.findMany({
    where: { deputeId },
    orderBy: { date: "asc" },
    include: { demandeur: { include: { organisation: true } } }
  });

  const creneaux = await prisma.creneau.findMany({
    where: { deputeId, debut: { gte: new Date() } },
    orderBy: { debut: "asc" },
    select: {
      id: true,
      debut: true,
      fin: true,
      statut: true,
      publicCible: true,
      rendezVous: { select: { id: true } }
    }
  });

  // Groupement par semaine
  const groupes = new Map<string, { label: string; rows: typeof rdvs }>();
  for (const rdv of rdvs) {
    const key = isoWeekKey(new Date(rdv.date));
    if (!groupes.has(key)) {
      groupes.set(key, { label: weekLabel(new Date(rdv.date)), rows: [] as any });
    }
    groupes.get(key)!.rows.push(rdv);
  }

  return (
    <div className={fr.cx("fr-container", "fr-py-4w")}>
      <h1>Calendrier des rendez-vous</h1>
      <p className={fr.cx("fr-text--lead")}>
        {rdvs.length} demande(s) de rendez-vous, regroupées par semaine.
      </p>

      <GestionCreneaux
        creneaux={creneaux.map((c) => ({
          id: c.id,
          debut: c.debut.toISOString(),
          fin: c.fin.toISOString(),
          statut: c.statut,
          publicCible: c.publicCible
        }))}
        canAct={user.role === "depute"}
      />

      {groupes.size === 0 ? (
        <p>Aucun rendez-vous demandé pour le moment.</p>
      ) : (
        Array.from(groupes.entries()).map(([key, groupe]) => (
          <div key={key} className={fr.cx("fr-mb-4w")}>
            <h2 className={fr.cx("fr-h5")}>{groupe.label}</h2>
            <Table
              fixed
              headers={["Date", "Demandeur", "Type", "Sujet", "Statut", ""]}
              data={groupe.rows.map((rdv) => [
                formatDate(new Date(rdv.date)),
                rdv.demandeur.displayName +
                  (rdv.demandeur.organisation ? ` (${rdv.demandeur.organisation.nomHatvp})` : ""),
                <Badge key="t" small noIcon severity={rdv.typeDemandeur === "representant" ? "warning" : "new"}>
                  {TYPE_LABEL[rdv.typeDemandeur] ?? rdv.typeDemandeur}
                </Badge>,
                rdv.sujet,
                <Badge key="s" small severity={(STATUT[rdv.statut] ?? STATUT.demande).severity}>
                  {(STATUT[rdv.statut] ?? STATUT.demande).label}
                </Badge>,
                <Link key="l" href={`/depute/rdv/${rdv.id}`} className={fr.cx("fr-link", "fr-link--sm")}>
                  Voir la fiche
                </Link>
              ])}
            />
          </div>
        ))
      )}
    </div>
  );
}
