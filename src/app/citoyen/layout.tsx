import { requireRole } from "@/lib/guards";

export default async function CitoyenLayout({
  children
}: {
  children: React.ReactNode;
}) {
  await requireRole(["citoyen"]);
  return <>{children}</>;
}
