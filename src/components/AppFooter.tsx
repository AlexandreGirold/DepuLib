"use client";

import { Footer } from "@codegouvfr/react-dsfr/Footer";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { fr } from "@codegouvfr/react-dsfr";
import { useEffect, useState } from "react";

const BRAND = <>RÉPUBLIQUE<br />FRANÇAISE</>;

export function AppFooter() {
  const [status, setStatus] = useState<{ mode: string; model: string } | null>(null);

  useEffect(() => {
    fetch("/api/ia/health")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ mode: "degrade", model: "—" }));
  }, []);

  return (
    <Footer
      brandTop={BRAND}
      accessibility="non compliant"
      contentDescription={
        <>
          <span>
            Dépulib — POC réalisé pour le hackathon « Le parcours de la loi : vers
            une IA de confiance » (Assemblée nationale, juillet 2026). Données de
            démonstration ; authentification simulée.
          </span>
          <br />
          <strong>Propulsé par Cloud Temple LLMaaS — IA souveraine SecNumCloud.</strong>{" "}
          Inférence en France, infrastructure qualifiée SecNumCloud et certifiée
          HDS ; données ni exploitées ni conservées après traitement.
          <span className={fr.cx("fr-mt-1w")} style={{ display: "block" }}>
            {status ? (
              <Badge severity={status.mode === "connecte" ? "success" : "warning"} small>
                {status.mode === "connecte"
                  ? `IA connectée — modèle ${status.model}`
                  : "Mode dégradé : IA indisponible (réponses de secours déterministes)"}
              </Badge>
            ) : null}
          </span>
        </>
      }
      homeLinkProps={{ href: "/", title: "Accueil — Dépulib" }}
      bottomItems={[
        { text: "À propos & garde-fous", linkProps: { href: "/a-propos" } },
        {
          text: "Cloud Temple LLMaaS",
          linkProps: { href: "https://docs.cloud-temple.com/llmaas", target: "_blank" }
        },
        {
          text: "Système de design de l'État",
          linkProps: {
            href: "https://www.systeme-de-design.gouv.fr",
            target: "_blank"
          }
        }
      ]}
    />
  );
}
