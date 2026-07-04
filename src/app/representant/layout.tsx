import { requireRole } from "@/lib/guards";

export default async function RepresentantLayout({
  children
}: {
  children: React.ReactNode;
}) {
  await requireRole(["representant"]);
  return <>{children}</>;
}
