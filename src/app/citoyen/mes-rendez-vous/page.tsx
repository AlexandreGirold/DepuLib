import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import Link from "next/link";
import { requireRole } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { parseJsonField } from "@/lib/sources";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mes rendez-vous — Dépulib" };

const STATUT_LABEL: Record<string, { label: string; severity: any }> = {
  demande: { label: "En attente", severity: "info" },
  accepte: { label: "Accepté", severity: "success" },
  refuse: { label: "Refusé", severity: "error" }
};

export default async function CitoyenMesRdvPage() {
  const user = await requireRole(["citoyen"]);

  const rdvs = await prisma.rendezVous.findMany({
    where: { demandeurId: user.id },
    orderBy: { date: "asc" },
    include: {
      depute: { select: { displayName: true } },
      rdvDossiers: { include: { dossier: { select: { titre: true } } } }
    }
  });

  return (
    <div className={fr.cx("fr-container", "fr-py-4w")}>
      <h1>Mes rendez-vous</h1>

      <div className={fr.cx("fr-btns-group", "fr-btns-group--inline-md", "fr-mb-3w")}>
        <Link href="/citoyen/rdv" className={fr.cx("fr-btn")}>
          Demander un nouveau rendez-vous
        </Link>
      </div>

      {rdvs.length === 0 ? (
        <p>Vous n'avez pas encore de rendez-vous. Demandez-en un ci-dessus.</p>
      ) : (
        rdvs.map((rdv) => {
          const brief = parseJsonField<{ contenu: string }>(rdv.briefIA);
          const st = STATUT_LABEL[rdv.statut] ?? STATUT_LABEL.demande;
          return (
            <div
              key={rdv.id}
              className={fr.cx("fr-p-3w", "fr-mb-3w")}
              style={{ border: "1px solid var(--border-default-grey)", borderRadius: 8 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <h2 className={fr.cx("fr-h5", "fr-mb-1v")}>{rdv.sujet}</h2>
                <Badge severity={st.severity} small>
                  {st.label}
                </Badge>
              </div>
              <p className={fr.cx("fr-text--sm", "fr-mb-1w")} style={{ color: "var(--text-mention-grey)" }}>
                {new Date(rdv.date).toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric"
                })}
                {" · "}
                {rdv.depute.displayName}
                {rdv.rdvDossiers.length > 0
                  ? ` · ${rdv.rdvDossiers.map((rd) => rd.dossier.titre).join(", ")}`
                  : ""}
              </p>
              {brief?.contenu && (
                <p className={fr.cx("fr-text--sm")}>
                  <strong>Brief :</strong> {brief.contenu}
                </p>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
