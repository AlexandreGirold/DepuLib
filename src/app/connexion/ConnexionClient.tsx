"use client";

import { fr } from "@codegouvfr/react-dsfr";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Select } from "@codegouvfr/react-dsfr/Select";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { FranceConnectButton } from "@codegouvfr/react-dsfr/FranceConnectButton";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Org = { nomHatvp: string; numeroHatvp: string; secteur: string };
type Etape = "accueil" | "identifiant" | "inscription";
type Espace = "citoyen" | "depute" | "representant";

type CompteExemple = { username: string; description: string };

const ESPACES: Record<
  Espace,
  { label: string; comptes: CompteExemple[] }
> = {
  citoyen: {
    label: "citoyen",
    comptes: [
      { username: "hugo.citoyen", description: "Hugo, citoyen (circonscription 93-07)" },
      { username: "lea.citoyenne", description: "Léa, citoyenne (circonscription 93-07)" }
    ]
  },
  depute: {
    label: "député / collaborateur",
    comptes: [
      { username: "marie.dupont", description: "Marie Dupont, députée (Commission des lois)" },
      { username: "paul.martin", description: "Paul Martin, collaborateur du cabinet" }
    ]
  },
  representant: {
    label: "représentant d'intérêts",
    comptes: [
      { username: "jean.lobby", description: "Jean, représentant (France Digitale — HATVP)" }
    ]
  }
};

export function ConnexionClient({ espace }: { espace?: string }) {
  const router = useRouter();
  const config = espace && espace in ESPACES ? ESPACES[espace as Espace] : null;
  const [etape, setEtape] = useState<Etape>(config ? "identifiant" : "accueil");
  const [username, setUsername] = useState(config ? config.comptes[0].username : "");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"citoyen" | "representant">("citoyen");
  const [circonscription, setCirconscription] = useState("93-07");
  const [numeroHatvp, setNumeroHatvp] = useState("");
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (etape === "inscription") {
      fetch("/api/organisations")
        .then((r) => r.json())
        .then(setOrgs)
        .catch(() => setOrgs([]));
    }
  }, [etape]);

  async function soumettreIdentifiant(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username })
      });
      const data = await res.json();
      if (data.needsRegistration) {
        setDisplayName(
          username
            .split(".")
            .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
            .join(" ")
        );
        setEtape("inscription");
      } else if (data.redirect) {
        router.push(data.redirect);
        router.refresh();
      } else {
        setError(data.error ?? "Erreur inconnue");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  async function soumettreInscription(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, displayName, role, circonscription, numeroHatvp })
      });
      const data = await res.json();
      if (data.ok && data.redirect) {
        router.push(data.redirect);
        router.refresh();
      } else {
        setError(data.error ?? "Erreur d'inscription");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  if (etape === "accueil") {
    return (
      <div className={fr.cx("fr-mt-4w")}>
        <div
          className={fr.cx("fr-p-4w")}
          style={{ border: "1px solid var(--border-default-grey)", borderRadius: 8 }}
        >
          <p className={fr.cx("fr-text--sm")}>
            FranceConnect est la solution proposée par l'État pour sécuriser et
            simplifier la connexion à vos services en ligne.
          </p>
          <FranceConnectButton onClick={() => setEtape("identifiant")} />
          <p className={fr.cx("fr-text--xs", "fr-mt-2w")} style={{ color: "var(--text-mention-grey)" }}>
            Démonstration : la connexion FranceConnect est simulée. Comptes
            disponibles : marie.dupont, paul.martin, hugo.citoyen, lea.citoyenne,
            jean.lobby.
          </p>
        </div>
      </div>
    );
  }

  if (etape === "identifiant") {
    return (
      <form onSubmit={soumettreIdentifiant} className={fr.cx("fr-mt-4w")}>
        {config && (
          <div className={fr.cx("fr-callout", "fr-callout--blue-ecume", "fr-mb-3w")}>
            <h2 className={fr.cx("fr-callout__title", "fr-h6")}>
              Se connecter à l'espace {config.label}
            </h2>
            <p className={fr.cx("fr-callout__text", "fr-text--sm", "fr-mb-1w")}>
              Pour la démonstration, utilisez l'un de ces identifiants (aucun mot de
              passe). Cliquez pour le pré-remplir.
            </p>
            <ul style={{ listStyle: "none", paddingLeft: 0, margin: 0 }}>
              {config.comptes.map((c) => (
                <li key={c.username} className={fr.cx("fr-mb-1w")}>
                  <button
                    type="button"
                    className={fr.cx("fr-tag", "fr-tag--sm")}
                    aria-pressed={username === c.username}
                    onClick={() => setUsername(c.username)}
                  >
                    {c.username}
                  </button>{" "}
                  <span className={fr.cx("fr-text--xs")} style={{ color: "var(--text-mention-grey)" }}>
                    {c.description}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {error && (
          <Alert severity="error" description={error} small className={fr.cx("fr-mb-2w")} closable={false} />
        )}
        <Input
          label="Nom d'utilisateur"
          hintText={config ? `Ex. ${config.comptes[0].username}` : "Ex. hugo.citoyen"}
          nativeInputProps={{
            value: username,
            onChange: (e) => setUsername(e.target.value),
            autoFocus: true,
            required: true
          }}
        />
        <div className={fr.cx("fr-btns-group", "fr-btns-group--inline-md")}>
          <button type="submit" className={fr.cx("fr-btn")} disabled={loading}>
            {loading ? "Connexion…" : "S'identifier avec FranceConnect"}
          </button>
          <button
            type="button"
            className={fr.cx("fr-btn", "fr-btn--secondary")}
            onClick={() => setEtape("accueil")}
          >
            Retour
          </button>
        </div>
      </form>
    );
  }

  // Inscription
  return (
    <form onSubmit={soumettreInscription} className={fr.cx("fr-mt-4w")}>
      <Alert
        severity="info"
        small
        className={fr.cx("fr-mb-2w")}
        description={`Compte « ${username} » inconnu : créons votre profil.`}
        closable={false}
      />
      {error && (
        <Alert severity="error" description={error} small className={fr.cx("fr-mb-2w")} closable={false} />
      )}
      <Input
        label="Nom affiché"
        nativeInputProps={{ value: displayName, onChange: (e) => setDisplayName(e.target.value) }}
      />
      <Select
        label="Votre rôle"
        nativeSelectProps={{ value: role, onChange: (e) => setRole(e.target.value as any) }}
      >
        <option value="citoyen">Citoyen</option>
        <option value="representant">Représentant d'intérêts (HATVP)</option>
      </Select>

      {role === "citoyen" && (
        <Input
          label="Circonscription"
          hintText="Ex. 93-07"
          nativeInputProps={{ value: circonscription, onChange: (e) => setCirconscription(e.target.value) }}
        />
      )}

      {role === "representant" && (
        <>
          <Select
            label="Numéro HATVP de votre organisation"
            hint="Vérifié contre le répertoire des représentants d'intérêts."
            nativeSelectProps={{ value: numeroHatvp, onChange: (e) => setNumeroHatvp(e.target.value) }}
          >
            <option value="">— Sélectionnez votre organisation —</option>
            {orgs.map((o) => (
              <option key={o.numeroHatvp} value={o.numeroHatvp}>
                {o.nomHatvp} ({o.secteur}) — n° {o.numeroHatvp}
              </option>
            ))}
          </Select>
        </>
      )}

      <div className={fr.cx("fr-btns-group", "fr-btns-group--inline-md")}>
        <button type="submit" className={fr.cx("fr-btn")} disabled={loading}>
          {loading ? "Création…" : "Créer mon compte"}
        </button>
        <button
          type="button"
          className={fr.cx("fr-btn", "fr-btn--secondary")}
          onClick={() => setEtape("identifiant")}
        >
          Retour
        </button>
      </div>
    </form>
  );
}
