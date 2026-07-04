"use client";

import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { useMemo, useState } from "react";

export type DeputeOption = {
  id: string;
  displayName: string;
  civilite: string | null;
  circonscription: string | null;
  departementNom: string | null;
  numDepartement: string | null;
  photoUrl: string | null;
};

const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const AVATAR_GENERIQUE = "/dsfr/artwork/pictograms/system/avatar.svg";
const MAX_DEPARTEMENTS = 8;
const MAX_RESULTATS_NOM = 8;
const SEUIL_RECHERCHE_NOM = 2;

// Déduit un numéro de département à partir d'un code postal à 5 chiffres :
// Corse-du-Sud/Haute-Corse partagent le code "2" dans les données (open data
// tricoteuses), les territoires d'outre-mer gardent leurs 3 premiers chiffres.
function departementDepuisCodePostal(cp: string): string | null {
  if (!/^\d{5}$/.test(cp)) return null;
  if (cp.startsWith("97") || cp.startsWith("98")) return cp.slice(0, 3);
  if (cp.startsWith("20")) return "2";
  return String(parseInt(cp.slice(0, 2), 10));
}

function CarteDepute({ depute, onClick }: { depute: DeputeOption; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={fr.cx("fr-btn", "fr-btn--tertiary")}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        width: "100%",
        textAlign: "left",
        height: "auto",
        padding: "0.75rem 1rem"
      }}
    >
      <img
        src={depute.photoUrl || AVATAR_GENERIQUE}
        alt=""
        width={48}
        height={48}
        style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
      <span style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <span>
          {depute.civilite ? `${depute.civilite} ` : ""}
          {depute.displayName}
        </span>
        <span className={fr.cx("fr-badges-group")}>
          {depute.circonscription && (
            <Badge small noIcon>
              Circonscription {depute.circonscription}
            </Badge>
          )}
        </span>
      </span>
    </button>
  );
}

export function DeputePicker({
  deputes,
  onSelect
}: {
  deputes: DeputeOption[];
  onSelect: (deputeId: string) => void;
}) {
  const [voirTous, setVoirTous] = useState(false);
  const [queryDept, setQueryDept] = useState("");
  const [queryNom, setQueryNom] = useState("");
  const [departementChoisi, setDepartementChoisi] = useState<string | null>(null);
  const [codePostalDetecte, setCodePostalDetecte] = useState<string | null>(null);

  const departements = useMemo(() => {
    const parDept = new Map<string, { numDepartement: string; departementNom: string; count: number }>();
    for (const d of deputes) {
      if (!d.numDepartement) continue;
      const key = d.numDepartement;
      const entry = parDept.get(key);
      if (entry) entry.count++;
      else
        parDept.set(key, {
          numDepartement: d.numDepartement,
          departementNom: d.departementNom || d.numDepartement,
          count: 1
        });
    }
    return [...parDept.values()];
  }, [deputes]);

  const departementsFiltres = useMemo(() => {
    const q = norm(queryDept.trim());
    if (!q) return [];
    return departements
      .filter((d) => norm(`${d.numDepartement} ${d.departementNom}`).includes(q))
      .slice(0, MAX_DEPARTEMENTS);
  }, [departements, queryDept]);

  const deputesDuDepartement = useMemo(() => {
    if (!departementChoisi) return [];
    return deputes.filter((d) => d.numDepartement === departementChoisi);
  }, [deputes, departementChoisi]);

  const departementDetecte = useMemo(
    () => departements.find((d) => d.numDepartement === departementChoisi) ?? null,
    [departements, departementChoisi]
  );

  // Recherche par nom/prénom directement depuis le champ département, pour ne
  // pas obliger à passer par « voir tous les député·es » quand on connaît déjà
  // le nom du député recherché.
  const deputesParNomFiltres = useMemo(() => {
    const q = norm(queryDept.trim());
    if (q.length < SEUIL_RECHERCHE_NOM || codePostalDetecte) return [];
    const mots = q.split(/\s+/);
    return deputes
      .filter((d) => {
        const hay = norm(`${d.civilite ?? ""} ${d.displayName}`);
        return mots.every((mot) => hay.includes(mot));
      })
      .slice(0, MAX_RESULTATS_NOM);
  }, [deputes, queryDept, codePostalDetecte]);

  const resultatsNom = useMemo(() => {
    const q = norm(queryNom.trim());
    if (!q) return [];
    return deputes
      .filter((d) => norm(`${d.displayName} ${d.circonscription ?? ""} ${d.departementNom ?? ""}`).includes(q))
      .slice(0, MAX_RESULTATS_NOM);
  }, [deputes, queryNom]);

  if (voirTous) {
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            setVoirTous(false);
            setQueryNom("");
          }}
          className={fr.cx("fr-link", "fr-icon-arrow-left-line", "fr-link--icon-left", "fr-mb-2w")}
        >
          Revenir à la recherche par département
        </button>
        <label className={fr.cx("fr-label")} htmlFor="depute-recherche-nom">
          Rechercher un député par nom
        </label>
        <div className={fr.cx("fr-search-bar")} role="search" style={{ maxWidth: 480 }}>
          <input
            id="depute-recherche-nom"
            className={fr.cx("fr-input")}
            type="search"
            value={queryNom}
            onChange={(e) => setQueryNom(e.target.value)}
            placeholder="Nom du député…"
            autoComplete="off"
          />
          <button type="button" className={fr.cx("fr-btn")} tabIndex={-1} title="Rechercher">
            Rechercher
          </button>
        </div>
        {queryNom.trim() && (
          <div className={fr.cx("fr-mt-2w")} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {resultatsNom.map((d) => (
              <CarteDepute key={d.id} depute={d} onClick={() => onSelect(d.id)} />
            ))}
            {resultatsNom.length === 0 && (
              <p className={fr.cx("fr-text--sm")} style={{ color: "var(--text-mention-grey)" }}>
                Aucun député ne correspond à « {queryNom} ».
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <label className={fr.cx("fr-label")} htmlFor="depute-recherche-departement">
        Votre département
        <span className={fr.cx("fr-hint-text")}>
          Recherchez par nom ou numéro de département, par code postal, ou
          directement par le nom du député que vous cherchez.
        </span>
      </label>
      <div className={fr.cx("fr-search-bar")} role="search" style={{ maxWidth: 480 }}>
        <input
          id="depute-recherche-departement"
          className={fr.cx("fr-input")}
          type="search"
          value={queryDept}
          onChange={(e) => {
            const valeur = e.target.value;
            setQueryDept(valeur);
            const code = departementDepuisCodePostal(valeur.trim());
            if (code && departements.some((d) => d.numDepartement === code)) {
              setDepartementChoisi(code);
              setCodePostalDetecte(valeur.trim());
            } else {
              setDepartementChoisi(null);
              setCodePostalDetecte(null);
            }
          }}
          placeholder="Ex. Rhône, 69, 69001, Seine-Saint-Denis, ou un nom de député…"
          autoComplete="off"
        />
        <button type="button" className={fr.cx("fr-btn")} tabIndex={-1} title="Rechercher">
          Rechercher
        </button>
      </div>

      <p className={fr.cx("fr-mt-1w")}>
        <button
          type="button"
          onClick={() => setVoirTous(true)}
          className={fr.cx("fr-link", "fr-icon-team-line", "fr-link--icon-left")}
        >
          Peu importe le département — voir tous les député·es
        </button>
      </p>

      {queryDept.trim() && !departementChoisi && (
        <div>
          {departementsFiltres.length > 0 && (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, maxWidth: 480 }}>
              {departementsFiltres.map((d) => (
                <li key={d.numDepartement} className={fr.cx("fr-mb-1w")}>
                  <button
                    type="button"
                    onClick={() => setDepartementChoisi(d.numDepartement)}
                    className={fr.cx("fr-btn", "fr-btn--tertiary")}
                    style={{ width: "100%", textAlign: "left" }}
                  >
                    {d.departementNom} ({d.numDepartement}) — {d.count} député{d.count > 1 ? "s" : ""}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {deputesParNomFiltres.length > 0 && (
            <div className={fr.cx("fr-mt-2w")}>
              <p className={fr.cx("fr-text--sm", "fr-mb-1w")} style={{ color: "var(--text-mention-grey)" }}>
                Député·es correspondant à « {queryDept} »
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {deputesParNomFiltres.map((d) => (
                  <CarteDepute key={d.id} depute={d} onClick={() => onSelect(d.id)} />
                ))}
              </div>
            </div>
          )}

          {departementsFiltres.length === 0 && deputesParNomFiltres.length === 0 && (
            <p className={fr.cx("fr-text--sm")} style={{ color: "var(--text-mention-grey)" }}>
              Aucun département ni député ne correspond à « {queryDept} ».
            </p>
          )}
        </div>
      )}

      {departementChoisi && (
        <div className={fr.cx("fr-mt-2w")}>
          {codePostalDetecte && departementDetecte && (
            <p className={fr.cx("fr-text--sm", "fr-mb-1w")}>
              <span className={fr.cx("fr-icon-map-pin-2-line", "fr-icon--sm")} aria-hidden />{" "}
              Département détecté à partir du code postal {codePostalDetecte} :{" "}
              {departementDetecte.departementNom} ({departementDetecte.numDepartement})
            </p>
          )}
          <p className={fr.cx("fr-text--sm", "fr-mb-1w")}>
            <button
              type="button"
              onClick={() => {
                setDepartementChoisi(null);
                setCodePostalDetecte(null);
                setQueryDept("");
              }}
              className={fr.cx("fr-link", "fr-icon-arrow-left-line", "fr-link--icon-left")}
            >
              Changer de département
            </button>
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {deputesDuDepartement.map((d) => (
              <CarteDepute key={d.id} depute={d} onClick={() => onSelect(d.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
