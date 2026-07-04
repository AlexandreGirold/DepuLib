"use client";

import { Footer } from "@codegouvfr/react-dsfr/Footer";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
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
        <span
          style={{ display: "inline-flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}
        >
          POC hackathon « IA de confiance » — Assemblée nationale, juillet 2026.
          IA souveraine Cloud Temple LLMaaS (SecNumCloud / HDS).
          {status ? (
            <Badge severity={status.mode === "connecte" ? "success" : "warning"} small noIcon>
              {status.mode === "connecte" ? `IA connectée — ${status.model}` : "Mode dégradé"}
            </Badge>
          ) : null}
        </span>
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
