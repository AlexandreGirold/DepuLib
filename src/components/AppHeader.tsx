"use client";

import { Header } from "@codegouvfr/react-dsfr/Header";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import type { MainNavigationProps } from "@codegouvfr/react-dsfr/MainNavigation";
import { usePathname, useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/session";

const BRAND = <>RÉPUBLIQUE<br />FRANÇAISE</>;

function navForRole(user: SessionUser | null, pathname: string): MainNavigationProps.Item[] {
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  if (!user) return [];
  if (user.role === "citoyen") {
    return [
      { text: "Dossiers en débat", linkProps: { href: "/citoyen" }, isActive: isActive("/citoyen") && !pathname.includes("quoi-de-neuf") && !pathname.includes("/rdv") },
      { text: "Quoi de neuf ?", linkProps: { href: "/citoyen/quoi-de-neuf" }, isActive: isActive("/citoyen/quoi-de-neuf") },
      { text: "Mes rendez-vous", linkProps: { href: "/citoyen/mes-rendez-vous" }, isActive: isActive("/citoyen/mes-rendez-vous") },
      { text: "Demander un rendez-vous", linkProps: { href: "/citoyen/rdv" }, isActive: isActive("/citoyen/rdv") }
    ];
  }
  if (user.role === "depute" || user.role === "collaborateur") {
    return [
      { text: "Tableau de bord", linkProps: { href: "/depute/dashboard" }, isActive: isActive("/depute/dashboard") },
      { text: "Calendrier", linkProps: { href: "/depute/calendrier" }, isActive: isActive("/depute/calendrier") }
    ];
  }
  if (user.role === "representant") {
    return [
      { text: "Mes rendez-vous", linkProps: { href: "/representant" }, isActive: isActive("/representant") && !pathname.includes("contributions") },
      { text: "Mes contributions", linkProps: { href: "/representant/contributions" }, isActive: isActive("/representant/contributions") }
    ];
  }
  return [];
}

export function AppHeader({ user }: { user: SessionUser | null }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  const roleLabel: Record<string, string> = {
    citoyen: "Citoyen",
    representant: "Représentant d'intérêts",
    depute: "Députée",
    collaborateur: "Collaborateur"
  };

  const quickAccess: any[] = user
    ? [
        {
          iconId: "fr-icon-account-circle-line",
          text: `${user.displayName} · ${roleLabel[user.role] ?? user.role}`,
          linkProps: { href: "#" }
        },
        {
          buttonProps: {
            onClick: async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.push("/");
              router.refresh();
            }
          },
          iconId: "fr-icon-logout-box-r-line",
          text: "Se déconnecter"
        }
      ]
    : [
        {
          iconId: "fr-icon-account-circle-line",
          text: "Se connecter",
          linkProps: { href: "/connexion" }
        }
      ];

  return (
    <Header
      brandTop={BRAND}
      serviceTitle={
        <>
          Dépulib{" "}
          {user?.role === "collaborateur" && user.deputeId ? (
            <Badge severity="info" small style={{ verticalAlign: "middle" }}>
              Espace partagé — Cabinet
            </Badge>
          ) : null}
        </>
      }
      serviceTagline="Relier l'avis citoyen au travail parlementaire"
      homeLinkProps={{
        href: user
          ? user.role === "citoyen"
            ? "/citoyen"
            : user.role === "representant"
            ? "/representant"
            : "/depute/dashboard"
          : "/",
        title: "Accueil — Dépulib"
      }}
      quickAccessItems={quickAccess}
      navigation={navForRole(user, pathname)}
    />
  );
}
