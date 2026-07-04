import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { requireRole } from "@/lib/guards";
import { prisma } from "@/lib/db";

export default async function DeputeLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(["depute", "collaborateur"]);

  let bandeau: string | null = null;
  if (user.role === "collaborateur" && user.deputeId) {
    const depute = await prisma.user.findUnique({ where: { id: user.deputeId } });
    bandeau = `Espace partagé — Cabinet de ${depute?.displayName ?? "la députée"}`;
  }

  return (
    <>
      {bandeau && (
        <div
          className={fr.cx("fr-py-1w")}
          style={{ background: "var(--background-contrast-info)", textAlign: "center" }}
        >
          <Badge severity="info" small>
            {bandeau}
          </Badge>
        </div>
      )}
      {children}
    </>
  );
}
