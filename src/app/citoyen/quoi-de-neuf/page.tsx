import { fr } from "@codegouvfr/react-dsfr";
import { requireRole } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { FeedClient, FeedItem } from "@/components/FeedClient";
import { parseJsonField } from "@/lib/sources";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quoi de neuf ? — Dépulib" };

export default async function QuoiDeNeufPage() {
  const user = await requireRole(["citoyen"]);
  const feed = await prisma.feedItem.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" }
  });

  const parsed = feed ? parseJsonField<{ items: FeedItem[] }>(feed.contenuIA) : null;
  const items = parsed?.items ?? [];

  return (
    <div className={fr.cx("fr-container", "fr-py-4w")}>
      <h1>Quoi de neuf ?</h1>
      <p className={fr.cx("fr-text--lead")}>
        Votre résumé mensuel personnalisé de l'actualité législative, à partir des
        dossiers qui vous concernent — chaque item renvoie à sa source officielle.
      </p>
      <FeedClient initialItems={items} hasFeed={Boolean(feed)} />
    </div>
  );
}
