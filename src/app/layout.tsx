import { DsfrHead } from "@codegouvfr/react-dsfr/next-appdir/DsfrHead";
import { DsfrProvider } from "@codegouvfr/react-dsfr/next-appdir/DsfrProvider";
import { getHtmlAttributes } from "@codegouvfr/react-dsfr/next-appdir/getHtmlAttributes";
import Link from "next/link";
import type { Metadata } from "next";
import { StartDsfr } from "./StartDsfr";
import { defaultColorScheme } from "./defaultColorScheme";
import { AppHeader } from "@/components/AppHeader";
import { AppFooter } from "@/components/AppFooter";
import { ViewBanner, VIEW_BANNER_HEIGHT } from "@/components/ViewBanner";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Dépulib — relier l'avis citoyen au travail parlementaire",
  description:
    "POC hackathon « Le parcours de la loi : vers une IA de confiance ». IA souveraine Cloud Temple LLMaaS."
};

const lang = "fr";

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  return (
    <html {...getHtmlAttributes({ defaultColorScheme, lang })}>
      <head>
        <StartDsfr />
        <DsfrHead Link={Link} />
        {/* CSS DSFR chargé directement depuis /public/dsfr (le bundling scss est
            contourné, cf. next.config.js). */}
        <link rel="stylesheet" href="/dsfr/dsfr.min.css" />
        <link rel="stylesheet" href="/dsfr/utility/icons/icons.min.css" />
      </head>
      <body>
        <DsfrProvider lang={lang}>
          <ViewBanner role={session.user?.role ?? null} />
          {/* Espace réservé : le bandeau est en position fixed (en haut), ce
              spacer évite qu'il masque le haut de l'en-tête. */}
          {session.user ? (
            <div
              aria-hidden="true"
              style={{ height: VIEW_BANNER_HEIGHT }}
            />
          ) : null}
          <AppHeader user={session.user ?? null} />
          <main role="main" id="contenu">
            {children}
          </main>
          <AppFooter />
        </DsfrProvider>
      </body>
    </html>
  );
}
