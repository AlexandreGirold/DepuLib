import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { Breadcrumb } from "@codegouvfr/react-dsfr/Breadcrumb";
import { notFound } from "next/navigation";
import { requireRole, peutAgirSurRdv } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { FicheHatvp } from "@/components/FicheHatvp";
import { BadgeSource } from "@/components/BadgeSource";
import { BandeauIA } from "@/components/BandeauIA";
import { RdvActions } from "@/components/RdvActions";
import { parseJsonField, Source } from "@/lib/sources";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  citoyen: "Citoyen",
  representant: "Représentant d'intérêts"
};

export default async function RdvFichePage({ params }: { params: { id: string } }) {
  const user = await requireRole(["depute", "collaborateur"]);
  const deputeId = user.role === "depute" ? user.id : user.deputeId;
  if (!deputeId) notFound();

  const rdv = await prisma.rendezVous.findUnique({
    where: { id: params.id },
    include: {
      demandeur: { include: { organisation: true } },
      rdvDossiers: { include: { dossier: true } },
      documents: true
    }
  });
  if (!rdv || rdv.deputeId !== deputeId) notFound();

  const brief = parseJsonField<{ contenu: string; sources: Source[] }>(rdv.briefIA);
  const briefSources = parseJsonField<Source[]>(rdv.sources) ?? brief?.sources ?? [];

  return (
    <div className={fr.cx("fr-container", "fr-py-4w")}>
      <Breadcrumb
        currentPageLabel="Fiche rendez-vous"
        homeLinkProps={{ href: "/depute/dashboard" }}
        segments={[{ label: "Calendrier", linkProps: { href: "/depute/calendrier" } }]}
      />

      <h1>{rdv.sujet}</h1>
      <p className={fr.cx("fr-text--lead")}>{formatDate(new Date(rdv.date))}</p>

      <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
        <div className={fr.cx("fr-col-12", "fr-col-md-7")}>
          <h2 className={fr.cx("fr-h5")}>Demandeur</h2>
          <p>
            <strong>{rdv.demandeur.displayName}</strong>{" "}
            <Badge small noIcon severity={rdv.typeDemandeur === "representant" ? "warning" : "new"}>
              {TYPE_LABEL[rdv.typeDemandeur] ?? rdv.typeDemandeur}
            </Badge>
          </p>

          {rdv.typeDemandeur === "representant" && rdv.demandeur.organisation && (
            <FicheHatvp org={rdv.demandeur.organisation} />
          )}

          {brief?.contenu && (
            <div className={fr.cx("fr-callout", "fr-callout--blue-ecume", "fr-mt-2w")}>
              <h3 className={fr.cx("fr-callout__title", "fr-h6")}>Brief IA du sujet</h3>
              <p className={fr.cx("fr-callout__text")}>{brief.contenu}</p>
              <BadgeSource sources={briefSources} />
              <BandeauIA />
            </div>
          )}

          {rdv.rdvDossiers.length > 0 && (
            <div className={fr.cx("fr-mt-3w")}>
              <h3 className={fr.cx("fr-h6")}>Dossiers liés</h3>
              <ul>
                {rdv.rdvDossiers.map((rd) => (
                  <li key={rd.dossierId}>
                    <a href={rd.dossier.sourceUrl} target="_blank" rel="noreferrer" className={fr.cx("fr-link")}>
                      {rd.dossier.titre}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rdv.documents.length > 0 && (
            <div className={fr.cx("fr-mt-3w")}>
              <h3 className={fr.cx("fr-h6")}>Documents fournis</h3>
              {rdv.documents.map((doc) => (
                <div
                  key={doc.id}
                  className={fr.cx("fr-p-2w", "fr-mb-2w")}
                  style={{ border: "1px solid var(--border-default-grey)", borderRadius: 8 }}
                >
                  <p className={fr.cx("fr-mb-1v")}>📎 <strong>{doc.filename}</strong></p>
                  {doc.resumeIA && (
                    <>
                      <Badge severity="warning" small noIcon>
                        Document fourni par un représentant d'intérêts — résumé IA non contradictoire
                      </Badge>
                      <p className={fr.cx("fr-text--sm", "fr-mt-1w")}>{doc.resumeIA}</p>
                      <BandeauIA />
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={fr.cx("fr-col-12", "fr-col-md-5")}>
          <div className={fr.cx("fr-p-3w")} style={{ border: "1px solid var(--border-default-grey)", borderRadius: 8 }}>
            <h2 className={fr.cx("fr-h5")}>Décision</h2>
            <RdvActions rdvId={rdv.id} statut={rdv.statut} canAct={peutAgirSurRdv(user)} />
          </div>
        </div>
      </div>
    </div>
  );
}
