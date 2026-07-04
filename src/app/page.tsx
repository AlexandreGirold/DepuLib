import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Tile } from "@codegouvfr/react-dsfr/Tile";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  const user = session.user;
  if (user) {
    if (user.role === "citoyen") redirect("/citoyen");
    if (user.role === "representant") redirect("/representant");
    redirect("/depute/dashboard");
  }

  return (
    <div className={fr.cx("fr-container", "fr-py-6w")}>
      <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
        <div className={fr.cx("fr-col-12", "fr-col-md-8")}>
          <h1>Dépulib — l'avis citoyen relié au texte de loi</h1>
          <p className={fr.cx("fr-text--lead")}>
            Des milliers de messages parviennent aux députés, sans boucle de retour
            vers le travail parlementaire réel. Dépulib relie chaque avis citoyen à
            l'amendement qui le concerne, résume les dossiers, et prépare les
            rendez-vous — le tout <strong>sourcé vers les textes officiels</strong>.
          </p>
          <div className={fr.cx("fr-btns-group", "fr-btns-group--inline-md")}>
            <Button linkProps={{ href: "/connexion" }}>
              S'identifier avec FranceConnect
            </Button>
            <Button priority="secondary" linkProps={{ href: "/a-propos" }}>
              Comprendre nos garde-fous IA
            </Button>
          </div>
        </div>
        <div className={fr.cx("fr-col-12", "fr-col-md-4")}>
          <div className={fr.cx("fr-callout", "fr-callout--blue-ecume")}>
            <h2 className={fr.cx("fr-callout__title", "fr-h5")}>IA de confiance</h2>
            <p className={fr.cx("fr-callout__text", "fr-text--sm")}>
              Chaque phrase générée est cliquable vers sa source officielle. L'IA
              préfère se taire (« information non disponible ») que d'inventer. La
              modération est transparente : rien n'est supprimé.
            </p>
          </div>
        </div>
      </div>

      <h2 className={fr.cx("fr-mt-6w")}>Trois espaces</h2>
      <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
        <div className={fr.cx("fr-col-12", "fr-col-md-4")}>
          <Tile
            title="Citoyen"
            desc="Comprendre un dossier, donner son avis, découvrir l'amendement qui répond à sa préoccupation."
            orientation="vertical"
            linkProps={{ href: "/connexion?espace=citoyen" }}
          />
        </div>
        <div className={fr.cx("fr-col-12", "fr-col-md-4")}>
          <Tile
            title="Député / Collaborateur"
            desc="Synthèse sourcée des avis, sentiment par amendement, calendrier des rendez-vous."
            orientation="vertical"
            linkProps={{ href: "/connexion?espace=depute" }}
          />
        </div>
        <div className={fr.cx("fr-col-12", "fr-col-md-4")}>
          <Tile
            title="Représentant d'intérêts"
            desc="Prendre rendez-vous, déposer une contribution tracée, dans la transparence HATVP."
            orientation="vertical"
            linkProps={{ href: "/connexion?espace=representant" }}
          />
        </div>
      </div>

      <p className={fr.cx("fr-text--sm", "fr-mt-4w")} style={{ color: "var(--text-mention-grey)" }}>
        Comptes de démonstration :{" "}
        <Link href="/connexion" className={fr.cx("fr-link", "fr-link--sm")}>
          marie.dupont
        </Link>{" "}
        (députée), paul.martin (collaborateur), hugo.citoyen / lea.citoyenne
        (citoyens), jean.lobby (représentant).
      </p>
    </div>
  );
}
