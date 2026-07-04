import { fr } from "@codegouvfr/react-dsfr";
import { requireRole } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { parseJsonField } from "@/lib/sources";
import { ActusClient, ActuGroup } from "@/components/ActusClient";
import { Actu, ActuLien, TOPICS, currentPeriode, periodeLabel } from "@/lib/actus";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quoi de neuf ? — Dépulib" };

function isValidPeriode(p: unknown): p is string {
  return typeof p === "string" && /^\d{4}-\d{2}$/.test(p);
}

export default async function QuoiDeNeufPage({
  searchParams
}: {
  searchParams?: { periode?: string };
}) {
  await requireRole(["citoyen"]);

  const current = currentPeriode();
  const selectedPeriode = isValidPeriode(searchParams?.periode)
    ? (searchParams!.periode as string)
    : current;

  // Mois disponibles (avec au moins une actualité), du plus récent au plus ancien.
  const distinctRows = await prisma.actualite.findMany({
    distinct: ["periode"],
    select: { periode: true },
    orderBy: { periode: "desc" }
  });
  const months = distinctRows.map((r) => r.periode);

  // Mois précédent réellement disponible (le plus proche strictement antérieur).
  const prevPeriode = months.find((m) => m < selectedPeriode) ?? null;

  // Actualités du mois sélectionné.
  const rows = await prisma.actualite.findMany({
    where: { periode: selectedPeriode },
    orderBy: { titre: "asc" }
  });

  const actus: Actu[] = rows.map((r) => ({
    id: r.id,
    periode: r.periode,
    topic: r.topic,
    titre: r.titre,
    contenu: r.contenu,
    resume: r.resume,
    sourceUrl: r.sourceUrl,
    liens: parseJsonField<ActuLien[]>(r.liens) ?? []
  }));

  // Regroupement par thématique, dans l'ordre canonique, thématiques vides omises.
  const groups: ActuGroup[] = TOPICS.map((topic) => ({
    topic,
    items: actus.filter((a) => a.topic === topic)
  })).filter((g) => g.items.length > 0);

  return (
    <div className={fr.cx("fr-container", "fr-py-4w")}>
      <h1>Quoi de neuf ?</h1>
      <p className={fr.cx("fr-text--lead")}>
        Les mesures qui entrent en application ce mois-ci, regroupées par thématique.
        Cliquez sur une actualité pour lire le détail et accéder aux sources officielles.
      </p>
      <p className={fr.cx("fr-badge", "fr-badge--info", "fr-mb-3w")}>
        {periodeLabel(selectedPeriode)}
      </p>
      <ActusClient
        groups={groups}
        selectedPeriode={selectedPeriode}
        currentPeriode={current}
        months={months}
        prevPeriode={prevPeriode}
      />
    </div>
  );
}
