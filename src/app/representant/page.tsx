import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import Link from "next/link";
import { requireRole } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { UploadPdf } from "@/components/UploadPdf";
import { parseJsonField } from "@/lib/sources";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mes rendez-vous — Dépulib" };

const STATUT_LABEL: Record<string, { label: string; severity: any }> = {
  demande: { label: "En attente", severity: "info" },
  accepte: { label: "Accepté", severity: "success" },
  refuse: { label: "Refusé", severity: "error" }
};

export default async function RepresentantHome() {
  const user = await requireRole(["representant"]);
  const org = user.organisationId
    ? await prisma.organisation.findUnique({ where: { id: user.organisationId } })
    : null;

  const rdvs = await prisma.rendezVous.findMany({
    where: { demandeurId: user.id },
    orderBy: { date: "asc" },
    include: {
      rdvDossiers: { include: { dossier: { select: { titre: true } } } },
      documents: { select: { id: true, filename: true, resumeIA: true } }
    }
  });

  return (
    <div className={fr.cx("fr-container", "fr-py-4w")}>
      <h1>Mes rendez-vous</h1>
      {org && (
        <p>
          <Badge severity="info" small>
            Représentant d'intérêts vérifié HATVP
          </Badge>{" "}
          <strong>{org.nomHatvp}</strong> — {org.secteur}
        </p>
      )}

      <div className={fr.cx("fr-btns-group", "fr-btns-group--inline-md", "fr-mb-3w")}>
        <Link href="/representant/rdv" className={fr.cx("fr-btn")}>
          Demander un nouveau rendez-vous
        </Link>
        <Link href="/representant/contributions" className={fr.cx("fr-btn", "fr-btn--secondary")}>
          Déposer une contribution sur un texte
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
                {rdv.rdvDossiers.length > 0
                  ? ` · ${rdv.rdvDossiers.map((rd) => rd.dossier.titre).join(", ")}`
                  : ""}
              </p>
              {brief?.contenu && (
                <p className={fr.cx("fr-text--sm")}>
                  <strong>Brief :</strong> {brief.contenu}
                </p>
              )}

              {rdv.documents.length > 0 && (
                <ul className={fr.cx("fr-text--sm")}>
                  {rdv.documents.map((d) => (
                    <li key={d.id}>
                      📎 {d.filename}
                      {d.resumeIA ? ` — ${d.resumeIA.slice(0, 120)}…` : ""}
                    </li>
                  ))}
                </ul>
              )}

              <div className={fr.cx("fr-mt-2w")}>
                <UploadPdf rdvId={rdv.id} />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
