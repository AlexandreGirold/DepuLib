import { fr } from "@codegouvfr/react-dsfr";
import { ConnexionClient } from "./ConnexionClient";

export const metadata = { title: "Connexion — Dépulib" };

const TITRES: Record<string, string> = {
  citoyen: "Espace citoyen",
  depute: "Espace député / collaborateur",
  representant: "Espace représentant d'intérêts"
};

export default function ConnexionPage({
  searchParams
}: {
  searchParams: { espace?: string };
}) {
  const espace =
    searchParams.espace && TITRES[searchParams.espace]
      ? searchParams.espace
      : undefined;

  return (
    <div className={fr.cx("fr-container", "fr-py-6w")}>
      <div className={fr.cx("fr-grid-row", "fr-grid-row--center")}>
        <div className={fr.cx("fr-col-12", "fr-col-md-8", "fr-col-lg-6")}>
          <h1>Se connecter{espace ? ` — ${TITRES[espace]}` : ""}</h1>
          <p>
            Identifiez-vous pour accéder à votre espace. Authentification{" "}
            <strong>simulée</strong> à des fins de démonstration (aucun mot de passe).
          </p>
          <ConnexionClient espace={espace} />
        </div>
      </div>
    </div>
  );
}
